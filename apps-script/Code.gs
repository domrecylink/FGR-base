/**
 * Backend Recylink FGR — Google Apps Script Web App (ligado a la hoja).
 *
 * Deploy: Implementar > Nueva implementación > Aplicación web
 *   - Ejecutar como: Yo
 *   - Quién tiene acceso: Cualquier persona
 * Copia la URL /exec a VITE_GAS_URL del frontend.
 *
 * Contrato:
 *   GET   -> { projects:[...], records:[...], events:[...] }
 *   POST  (Content-Type: text/plain, body JSON) -> { ok:true } | { ok:false, error }
 *         body = { entity:"project"|"record"|"event", action:"create"|"update"|"delete", data:{...} }
 *
 * Notas:
 *   - text/plain evita el preflight CORS que Apps Script no soporta.
 *   - LockService serializa las escrituras (evita corrupción por carreras).
 *   - Las filas se localizan por columna "id" (nunca por número de fila).
 */

var SHEETS = {
  project: {
    tab: 'Projects',
    headers: ['id', 'branch_name', 'total_m2', 'max_fgr_target'],
  },
  record: {
    tab: 'Records',
    headers: [
      'id',
      'project_id',
      'month',
      'progress_mode',
      'progress_value',
      'accumulated_m2',
      'waste_json',
      'co2_avoided_ton',
    ],
  },
  event: {
    tab: 'Events',
    headers: ['id', 'project_id', 'name', 'month'],
  },
  wasteType: {
    tab: 'WasteTypes',
    headers: ['id', 'name', 'valorizable'],
  },
};

/** Ejecuta una vez desde el editor para crear las pestañas y encabezados. */
function init() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(SHEETS).forEach(function (key) {
    var cfg = SHEETS[key];
    var sheet = ss.getSheetByName(cfg.tab);
    if (!sheet) sheet = ss.insertSheet(cfg.tab);
    var firstRow = sheet.getRange(1, 1, 1, cfg.headers.length).getValues()[0];
    var empty = firstRow.every(function (c) {
      return c === '' || c === null;
    });
    if (empty) {
      sheet.getRange(1, 1, 1, cfg.headers.length).setValues([cfg.headers]);
      sheet.setFrozenRows(1);
    }
  });
}

/**
 * Ejecuta desde el editor después de actualizar este archivo: agrega al final las columnas nuevas
 * de cada pestaña ya existente (init() sólo escribe encabezados cuando la fila 1 está vacía).
 * Las filas se leen por posición, así que el orden de las columnas existentes debe coincidir.
 */
function migrate() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var log = [];
  Object.keys(SHEETS).forEach(function (key) {
    var cfg = SHEETS[key];
    var sheet = ss.getSheetByName(cfg.tab);
    if (!sheet) {
      log.push(cfg.tab + ': no existe (corre init()).');
      return;
    }
    var width = Math.max(sheet.getLastColumn(), 1);
    var current = sheet
      .getRange(1, 1, 1, width)
      .getValues()[0]
      .map(function (c) {
        return String(c).trim();
      })
      .filter(function (c) {
        return c !== '';
      });

    for (var i = 0; i < current.length; i++) {
      if (cfg.headers[i] !== current[i]) {
        throw new Error(
          'La pestaña "' + cfg.tab + '" tiene la columna ' + (i + 1) + ' como "' + current[i] +
            '" y se esperaba "' + cfg.headers[i] + '". Ordénalas antes de migrar.',
        );
      }
    }

    var added = [];
    for (var j = current.length; j < cfg.headers.length; j++) {
      sheet.getRange(1, j + 1).setValue(cfg.headers[j]);
      added.push(cfg.headers[j]);
    }
    log.push(cfg.tab + ': ' + (added.length ? 'agregadas ' + added.join(', ') : 'sin cambios'));
  });
  Logger.log(log.join('\n'));
  return log.join('\n');
}

function doGet() {
  try {
    return json({
      projects: readRows('project'),
      records: readRows('record'),
      events: readRows('event'),
      wasteTypes: readRows('wasteType'),
    });
  } catch (err) {
    return json({ error: String(err) });
  }
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var body = JSON.parse(e.postData.contents);
    var entity = body.entity;
    var action = body.action;
    var data = body.data || {};
    if (!SHEETS[entity]) throw new Error('Entidad desconocida: ' + entity);

    // El mapa de residuos se guarda como texto JSON en una sola celda.
    if (entity === 'record') data.waste_json = JSON.stringify(data.waste || {});

    if (action === 'create') {
      appendRow(entity, data);
    } else if (action === 'update') {
      updateRowById(entity, data);
    } else if (action === 'delete') {
      if (entity === 'project') cascadeDeleteProject(data.id);
      else deleteRowById(entity, data.id);
    } else {
      throw new Error('Acción desconocida: ' + action);
    }
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

// ---- Helpers ----

function sheetOf(entity) {
  var cfg = SHEETS[entity];
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg.tab);
  if (!sheet) throw new Error('Falta la pestaña "' + cfg.tab + '". Ejecuta init().');
  return sheet;
}

function readRows(entity) {
  var cfg = SHEETS[entity];
  var sheet = sheetOf(entity);
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, cfg.headers.length).getValues();
  return values
    .filter(function (row) {
      return String(row[0]).trim() !== '';
    })
    .map(function (row) {
      var obj = {};
      cfg.headers.forEach(function (h, i) {
        obj[h] = row[i];
      });
      return obj;
    });
}

function appendRow(entity, data) {
  var cfg = SHEETS[entity];
  var sheet = sheetOf(entity);
  var row = cfg.headers.map(function (h) {
    return data[h] !== undefined && data[h] !== null ? data[h] : '';
  });
  sheet.appendRow(row);
}

function findRowNumberById(sheet, id) {
  var last = sheet.getLastRow();
  if (last < 2) return -1;
  var ids = sheet.getRange(2, 1, last - 1, 1).getValues();
  for (var i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2; // fila real (1-based, +header)
  }
  return -1;
}

function updateRowById(entity, data) {
  var cfg = SHEETS[entity];
  var sheet = sheetOf(entity);
  var rowNum = findRowNumberById(sheet, data.id);
  if (rowNum === -1) throw new Error('No se encontró id ' + data.id);
  var row = cfg.headers.map(function (h) {
    return data[h] !== undefined && data[h] !== null ? data[h] : '';
  });
  sheet.getRange(rowNum, 1, 1, cfg.headers.length).setValues([row]);
}

function deleteRowById(entity, id) {
  var sheet = sheetOf(entity);
  var rowNum = findRowNumberById(sheet, id);
  if (rowNum === -1) return; // ya no existe: idempotente
  sheet.deleteRow(rowNum);
}

/** Borra el proyecto y, en cascada, sus registros y eventos. */
function cascadeDeleteProject(projectId) {
  deleteRowById('project', projectId);
  deleteRowsByColumn('record', 'project_id', projectId);
  deleteRowsByColumn('event', 'project_id', projectId);
}

function deleteRowsByColumn(entity, column, value) {
  var cfg = SHEETS[entity];
  var sheet = sheetOf(entity);
  var last = sheet.getLastRow();
  if (last < 2) return;
  var colIndex = cfg.headers.indexOf(column); // 0-based
  var values = sheet.getRange(2, 1, last - 1, cfg.headers.length).getValues();
  // Borra de abajo hacia arriba para no invalidar los índices.
  for (var i = values.length - 1; i >= 0; i--) {
    if (String(values[i][colIndex]) === String(value)) {
      sheet.deleteRow(i + 2);
    }
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
