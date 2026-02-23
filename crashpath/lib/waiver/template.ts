// src/lib/waiver/template.ts

export const WAIVER_VERSION = "v1";

/**
 * PLACEHOLDERS DISPONIBLES:
 *
 * {{CITY_LINE}}      → "Bucaramanga, Santander — 23/02/2026"
 * {{MINOR_TAG}}      → Texto opcional si es menor
 * {{INTRO_BLOCK}}    → Intro distinta para menor/adulto
 * {{MINOR_BLOCK}}    → Sección adicional solo para menores
 *
 * IMPORTANTE:
 * - Usa doble salto de línea (\n\n) para separar párrafos.
 * - NO pongas lógica aquí.
 * - Este archivo es solo plantilla legal.
 */

export const WAIVER_TEMPLATE = `
EXIMENTE DE RESPONSABILIDAD, DECLARACIÓN DE ASUNCIÓN DE RIESGOS,
AUTORIZACIÓN PARA EL TRATAMIENTO DE DATOS PERSONALES
Y AUTORIZACIÓN DE USO DE IMAGEN

CRASH PATH – ESCUELA DE ESCALADA

{{MINOR_TAG}}

{{CITY_LINE}}

{{INTRO_BLOCK}}

PRIMERO: Conocimiento de la actividad y sus riesgos

Declaro que conozco y comprendo que la práctica de la escalada en muro,
boulder y demás actividades físicas desarrolladas en las instalaciones
de CRASH PATH implica riesgos inherentes que pueden generar lesiones
leves, graves o incluso fatales.

Reconozco que dichos riesgos pueden derivarse de caídas, uso incorrecto
de equipos, errores propios o de terceros, condiciones del entorno,
entre otros factores propios de la naturaleza de la actividad.


SEGUNDO: Conocimiento y aplicación de normas de seguridad

Declaro que me comprometo a seguir las instrucciones del personal
autorizado, utilizar adecuadamente los equipos de protección
y respetar los protocolos de seguridad establecidos por CRASH PATH.


TERCERO: Asunción voluntaria del riesgo

Acepto voluntariamente participar en las actividades ofrecidas por
CRASH PATH, asumiendo plena responsabilidad por cualquier lesión
o daño que pueda sufrir como consecuencia de mi participación.


CUARTO: Responsabilidad frente a terceros

Me comprometo a actuar con diligencia y prudencia, evitando conductas
que puedan poner en riesgo mi integridad o la de otros participantes.


QUINTO: Estado de salud

Declaro que me encuentro en condiciones físicas y de salud adecuadas
para participar en las actividades de escalada y que no padezco
enfermedades o limitaciones que me impidan realizar esta actividad,
salvo que haya informado previamente a la administración.


SEXTO: Exención de responsabilidad

En virtud de lo anterior, libero expresamente de toda responsabilidad
civil, contractual o extracontractual a CRASH PATH, sus propietarios,
instructores, empleados y colaboradores, por cualquier daño o lesión
derivada de mi participación en las actividades ofrecidas.


SÉPTIMO: Autorización para el tratamiento de datos personales

Autorizo de manera libre, previa, expresa e informada a CRASH PATH
para recolectar, almacenar y tratar mis datos personales conforme
a la normativa vigente en Colombia en materia de protección de datos,
únicamente para fines administrativos, operativos y de seguridad.


OCTAVO: Autorización de uso de imagen

Autorizo a CRASH PATH para utilizar mi imagen en fotografías o videos
capturados durante el desarrollo de actividades, con fines promocionales,
publicitarios o informativos, sin que ello genere derecho a compensación económica.


{{MINOR_BLOCK}}


DECLARACIÓN FINAL

Declaro que he leído íntegramente el presente documento,
que comprendo su contenido y que lo acepto de manera libre y voluntaria.

`.trim();