// Textos de los tooltips del dashboard. Viven acá para no inflar Dashboard.tsx y para que la
// explicación de cada métrica se lea junta (y se corrija junta si cambia el cálculo en domain/fgr.ts).

import type { InfoTipContent } from '../components/ds/InfoTip'
import type { FgrMode } from '../types'

const M2 =
  'Los m² vienen del avance de obra: si lo cargas en %, se multiplican por los m² totales de la sucursal; si lo cargas en m², el valor ya es el acumulado.'
const TRATAMIENTO =
  'Valorizado o no lo define el tratamiento de cada retiro, no el tipo de residuo: la misma madera valoriza si va a compostaje y no valoriza si va a relleno sanitario.'
const DESCONOCIDO =
  'Un tratamiento que no esté en la lista conocida se cuenta como NO valorizado, así que este número es conservador.'
const PENDIENTE =
  'Los meses sin avance de obra no tienen m² por los que dividir: quedan como hueco en el gráfico, pero sus m³ sí entran al acumulado.'
const FILTRO =
  'El filtro de tipos de residuo cambia sólo los m³; los m² de la sucursal no se tocan, así que un FGR filtrado no es comparable con la meta.'
const IMPORTACION =
  'De la planilla de trazabilidad sólo se importan los retiros en estado Finalizada con volumen mayor que cero.'

/** Sufijo "del mes" / "acumulado" para los textos que dependen del modo. */
export function modeWord(mode: FgrMode): string {
  return mode === 'monthly' ? 'del mes' : 'acumulado'
}

function m3Formula(mode: FgrMode, numerador: string): string[] {
  return mode === 'monthly'
    ? [`${numerador} del mes`, '───────────────────', 'm² construidos ese mes']
    : [`Σ ${numerador} hasta el mes`, '───────────────────', 'm² acumulados a la fecha']
}

export function fgrGlobalHelp(mode: FgrMode): InfoTipContent {
  return {
    title: mode === 'monthly' ? 'FGR global del mes' : 'FGR global acumulado',
    formula: m3Formula(mode, 'm³ de residuo'),
    lines: [
      mode === 'monthly'
        ? 'Cada mes se calcula aislado: los m³ retirados ese mes divididos por los m² que se construyeron ese mes (avance del mes menos avance del mes anterior).'
        : 'Es un promedio corrido desde el primer mes: todo el residuo acumulado dividido por todos los m² construidos hasta la fecha. Por eso se mueve menos que el mensual.',
      M2,
      'Es la suma del FGR valorizado más el no valorizado.',
      PENDIENTE,
      FILTRO,
    ],
  }
}

export function fgrValorizadoHelp(mode: FgrMode): InfoTipContent {
  return {
    title: `FGR valorizado ${modeWord(mode)}`,
    formula: m3Formula(mode, 'm³ valorizados'),
    lines: [
      'Mismo divisor que el FGR global: sólo cambia el numerador, que toma únicamente los m³ que terminaron en un tratamiento que recupera el residuo (compostaje, reciclaje, reutilización, coprocesamiento, valorización energética, biodigestión, lombricultura).',
      TRATAMIENTO,
      DESCONOCIDO,
      'Bajar este número no es bueno ni malo por sí solo: si el FGR global bajó parejo, generaste menos residuo. Para ver la calidad del manejo, mira el % de valorización.',
    ],
  }
}

export function fgrNoValorizadoHelp(mode: FgrMode): InfoTipContent {
  return {
    title: `FGR no valorizado ${modeWord(mode)}`,
    formula: m3Formula(mode, 'm³ no valorizados'),
    lines: [
      'Los m³ que fueron a disposición final: relleno sanitario, relleno de seguridad, incineración, tratamiento físico-químico.',
      DESCONOCIDO,
      TRATAMIENTO,
      'Es la parte del FGR global que conviene atacar primero: baja el total y sube el % de valorización a la vez.',
    ],
  }
}

export function wasteTotalHelp(mode: FgrMode): InfoTipContent {
  return {
    title: `Residuo total retirado ${modeWord(mode)}`,
    formula:
      mode === 'monthly'
        ? ['m³ valorizados + m³ no valorizados', '(sólo el último mes con registro)']
        : ['Σ (m³ valorizados + m³ no valorizados)', '(todos los meses con registro)'],
    lines: [
      'Volumen puro, sin dividir por m²: no depende del avance de obra, así que existe también en los meses con avance pendiente.',
      IMPORTACION,
      'Si tienes filtro de tipos activo, cuenta sólo los tipos seleccionados.',
    ],
  }
}

export function evolucionHelp(mode: FgrMode): InfoTipContent {
  return {
    title: `Evolución del FGR (${mode === 'monthly' ? 'mensual' : 'acumulado'})`,
    formula: m3Formula(mode, 'm³ de residuo'),
    lines: [
      'Tres líneas sobre el mismo divisor: FGR global (azul), valorizado (verde) y no valorizado (gris). Las dos últimas suman la primera.',
      mode === 'monthly'
        ? 'En modo mensual cada punto es independiente del anterior, así que se ven los picos de generación.'
        : 'En modo acumulado cada punto incluye todos los meses previos, así que la curva se va aplanando.',
      'La línea roja punteada es la meta de la sucursal (se oculta si hay filtro de residuos, porque un FGR parcial no se compara con la meta). Las verticales son los hitos que cargaste.',
      PENDIENTE,
      'El eje X salta los meses sin registro: no se rellenan con ceros.',
    ],
  }
}

export function pctValorizacionHelp(mode: FgrMode): InfoTipContent {
  return {
    title: `% de valorización ${modeWord(mode)}`,
    formula: [
      'm³ valorizados',
      '────────────── × 100',
      'm³ totales',
    ],
    lines: [
      'Es la única métrica de esta pantalla que NO divide por m²: mide la calidad del manejo del residuo, no cuánto residuo generas.',
      'Por eso existe incluso en los meses con avance de obra pendiente, donde el FGR queda vacío.',
      mode === 'monthly'
        ? 'En modo mensual es el porcentaje de ese mes aislado.'
        : 'En modo acumulado es el porcentaje de toda la obra hasta la fecha, no el del último mes.',
      TRATAMIENTO,
      DESCONOCIDO,
    ],
  }
}

export function valorizacionPorM2Help(mode: FgrMode): InfoTipContent {
  return {
    title: `Valorización por m² (${mode === 'monthly' ? 'mensual' : 'acumulada'})`,
    formula: m3Formula(mode, 'm³ valorizados'),
    lines: [
      'Es la misma línea verde del gráfico de arriba, sola y con su propia escala para poder verle el detalle.',
      'Responde "cuánto residuo recuperado genera cada m² construido", mientras que el % de valorización responde "qué proporción del residuo se recuperó".',
      'Sube si valorizas más, pero también sube si simplemente generas más residuo. Léela junto al FGR global.',
      PENDIENTE,
      M2,
    ],
  }
}
