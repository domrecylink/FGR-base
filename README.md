# Recylink · FGR

Aplicación web para que los clientes de Recylink registren el **avance de obra** y la
**generación de residuos** de sus proyectos, y visualicen el **FGR** (Factor de Generación
de Residuos = m³/m²) en una gráfica de líneas.

- **Frontend:** React + Vite + TypeScript + Recharts. Se aloja en **GitHub Pages**.
- **Backend:** **Google Apps Script** (Web App ligado a la hoja). No hay Node/Express ni cuenta de servicio.
- **Base de datos:** una **Google Sheet** con 3 pestañas.
- **Toda la lógica de cálculo** (m² acumulados, deltas mensuales, FGR mensual/acumulado) vive en el frontend (TypeScript, con pruebas). Apps Script solo lee/escribe celdas.

> ⚠️ **Seguridad (importante).** El Web App se publica con acceso **“Cualquiera”** y **sin
> autenticación**: cualquiera con la URL puede leer, editar y borrar los datos. Es una decisión
> deliberada para una v1 “muy cruda”. **Mantén una copia de respaldo de la hoja** (Archivo →
> Hacer una copia periódicamente) y no publiques la URL más de lo necesario.

---

## 1. Crear la hoja y el backend (Apps Script)

1. Crea una **Google Sheet** nueva (será la base de datos).
2. En la hoja: **Extensiones → Apps Script**.
3. Borra el contenido y **pega** el archivo [`apps-script/Code.gs`](apps-script/Code.gs).
4. Guarda. En el selector de funciones elige **`init`** y pulsa **Ejecutar**. Autoriza los
   permisos cuando lo pida. Esto crea las pestañas `Projects`, `Records`, `Events` con sus
   encabezados.
5. Pulsa **Implementar → Nueva implementación → Aplicación web**:
   - **Descripción:** `FGR API`
   - **Ejecutar como:** _Yo_
   - **Quién tiene acceso:** _Cualquier persona_
6. Copia la **URL del Web App** (termina en `/exec`). La usarás como `VITE_GAS_URL`.

> Cada vez que edites `Code.gs` debes **crear una implementación nueva** (o “Administrar
> implementaciones → editar → Nueva versión”) para que los cambios tomen efecto en la URL.

### Esquema de las pestañas (referencia)

| Pestaña      | Columnas (en este orden)                                                                                            |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| `Projects`   | `id`, `branch_name`, `total_m2`, `max_fgr_target`                                                                    |
| `Records`    | `id`, `project_id`, `month`, `progress_mode`, `progress_value`, `accumulated_m2`, `waste_json`, `co2_avoided_ton`    |
| `Events`     | `id`, `project_id`, `name`, `month`                                                                                  |
| `WasteTypes` | `id`, `name`, `valorizable`                                                                                          |

- `month` = `YYYY-MM`.
- `progress_mode` = `percentage` o `m2`. **`progress_value` vacío = avance pendiente** (el mes existe
  con sus m³ pero todavía no tiene FGR).
- `waste_json` = mapa JSON `{ "<wasteTypeId>": { "val": m3, "noVal": m3 } }`: los m³ ya vienen
  partidos por valorización, porque la define el **tratamiento** de cada retiro y un mismo residuo
  puede ir a tratamientos distintos. El formato antiguo (`{ "<wasteTypeId>": m3 }`) se sigue leyendo:
  se reparte con el flag `valorizable` del tipo.
- `co2_avoided_ton` = Tons. CO2eq. evitadas del mes (viene del export de trazabilidad; se guarda pero
  todavía no se muestra).
- `WasteTypes` es **global** (común a todas las sucursales); `valorizable` (TRUE/FALSE) es sólo el
  **valor por defecto de la captura manual**.

> **Si la hoja ya existía:** después de pegar la versión nueva de `Code.gs`, ejecuta la función
> **`migrate()`** desde el editor. Agrega al final las columnas nuevas de cada pestaña (`init()` sólo
> escribe encabezados cuando la fila 1 está vacía). Luego crea una **nueva implementación** del Web App.
- `accumulated_m2` es un **espejo de solo lectura** (lo escribe el frontend). La gráfica siempre
  se recalcula desde los valores crudos.
- Tras crear la primera sucursal, ve a **Ingreso mensual → Tipos de residuo → “Usar lista
  sugerida”** para poblar tipos iniciales (Escombro, Madera, Metal, Cartón, Plástico, Yeso).

---

## 2. Correr el frontend en local

Requiere Node 20+.

```bash
cp .env.example .env
# edita .env y pega tu URL en VITE_GAS_URL
npm install
npm run dev
```

Abre la URL que imprime Vite. Otros comandos:

```bash
npm test        # pruebas de la lógica de dominio (Vitest)
npm run build   # build de producción
npm run preview # sirve el build local
```

---

## 3. Publicar en GitHub Pages

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) compila y publica en
cada push a `main`.

1. Crea el repo en GitHub y súbelo (por ejemplo `FGR`).
2. **Settings → Secrets and variables → Actions → New repository secret:**
   - Nombre: `VITE_GAS_URL` · Valor: la URL `/exec` del Web App.
3. **Settings → Pages → Build and deployment → Source: _GitHub Actions_.**
4. Haz push a `main`. El workflow arma el sitio en `https://<usuario>.github.io/<repo>/`.

> El `base` de Vite se calcula solo como `/<nombre-del-repo>/` en el workflow. En local no
> importa. Si sirves el build fuera de Actions, define `VITE_BASE` a mano.

---

## Carga desde el Excel de Trazabilidad

El export de la plataforma trae **una fila por retiro**. La app lo agrega por mes para la **sucursal
seleccionada**. Columnas que lee (por nombre de encabezado, no por posición):

| Columna del export        | Uso                                                          |
| ------------------------- | ------------------------------------------------------------ |
| `Sucursal`                | debe coincidir con el nombre de la sucursal en la app         |
| `Estado`                  | filtro: sólo se importa **Finalizada**                        |
| `Residuo`                 | tipo de residuo (se crea si no existe)                        |
| `Volumen Calculado`       | m³                                                            |
| `Fecha de Operación`      | define el mes (`YYYY-MM`); acepta serial de Excel o texto     |
| `Tipo de Tratamiento`     | define si esos m³ son **valorizados** o no                    |
| `Tons. CO2eq. evitadas`   | se suma al mes y se guarda                                    |

- La tabla tratamiento → valorizado está **hardcodeada** en [`src/domain/treatments.ts`](src/domain/treatments.ts).
  Un tratamiento que no esté en esa lista se importa como **no valorizado** y la vista previa lo
  muestra para que lo agregues.
- La planilla **no trae avance de obra**: cada mes se crea con el avance **pendiente**. En la Planilla
  aparece con el chip “Pendiente” y el Dashboard avisa cuántos meses faltan. Sin avance no hay m² para
  dividir, así que esos meses no tienen FGR (sus m³ sí cuentan en el acumulado).
- Si el mes ya existe, la vista previa lo marca y eliges **Reemplazar** (sobrescribe m³ y CO₂,
  conserva el avance capturado) u **Omitir**.
- El lector de `.xlsx` es propio ([`src/utils/xlsx.ts`](src/utils/xlsx.ts), sobre `fflate`): sólo
  interpreta valores y shared strings, sin formatos.

---

## Reglas de negocio (resumen)

- Un cliente tiene varios proyectos. Crear uno requiere: sucursal, m² totales y FGR objetivo (fijo).
- El avance es **acumulado a la fecha**; se captura en **%** o en **m²**, ambos se convierten a `accumulated_m2`.
- **m² del mes** = `accumulated_m2(mes) − accumulated_m2(mes anterior existente)`. Meses saltados = huecos.
- Un registro por **(proyecto, mes)**.
- Switch **Mensual / Acumulado**:
  - Mensual: residuo y m² de ese mes.
  - Acumulado: residuo y m² acumulados.
- Tres líneas: **FGR global**, **Valorizado**, **No valorizado** (según el **tratamiento** de cada
  retiro, guardado por registro). Línea punteada horizontal = **meta máxima**.
- **Hitos** = líneas verticales punteadas, ancladas a un mes.
- Si el m² del mes es **≤ 0** no se calcula FGR (hueco en la gráfica + fila marcada). Un retroceso
  de avance se **advierte** pero se permite guardar.
- Todo es **editable y eliminable**; cada borrado pide confirmación (la sucursal exige teclear su
  nombre). Borrar una sucursal borra en cascada sus meses e hitos.

## Pantallas

- **Sucursales**: lista con avance, FGR acumulado y estado; crear / configurar / eliminar.
- **Dashboard FGR**: KPIs, alerta de meta y gráfico, con switch Mensual / Acumulado.
- **Ingreso mensual**: pestañas Planilla (edición inline) · Hitos · Tipos de residuo · Configuración.
- **Carga masiva**: dos pestañas —
  - **Trazabilidad (Excel)**: sube el export "Detalle Trazabilidad" de la plataforma (`.xlsx`).
  - **CSV de avance**: el formato propio `mes;modo;avance;<tipos>` (delimitador `;`).
- **Onboarding**: intro de 3 pasos (accesible desde la barra lateral).

## Estructura

```
apps-script/Code.gs        Backend (doGet/doPost, LockService, cascada, migrate)
src/domain/fgr.ts          Cálculo de FGR + validación (+ fgr.test.ts)
src/domain/summary.ts      Resumen por proyecto (avance, estado, tono)
src/domain/trazabilidad.ts Lectura del export de trazabilidad -> meses (+ test)
src/domain/treatments.ts   Tratamiento -> valorizado (hardcodeado)
src/utils/xlsx.ts          Lector mínimo de .xlsx (fflate)
src/api/gas.ts             Cliente HTTP del Web App (POST text/plain)
src/store/DataContext.tsx  Estado global + CRUD optimista (4 entidades)
src/components/ds/         Sistema de diseño: Button, Card, Input, Modal, StatusChip, Toast
src/pages/                 Onboarding, Sucursales, Dashboard, IngresoMensual, CargaMasiva
```

> **Logo**: coloca `logo-color-horizontal.png` del proyecto de diseño en `public/logo-recylink.png`.
> Mientras no exista, se muestra un wordmark de texto “Recylink”.
