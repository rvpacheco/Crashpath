// Textos del landing en español (/) y en inglés (/en). El diseño es uno solo
// (components/Landing.js); aquí solo vive lo que se lee.
//
// - **negrita** se pinta como <b> (ver `rich` en Landing.js).
// - Los precios en inglés llevan "COP": en inglés "$20.000" se lee como 20
//   dólares y es veinte mil pesos. Sin conversión a USD a propósito: se
//   desactualiza y los precios son decisión del negocio.
// - Si agregas una clave aquí, agrégala en los dos idiomas: un test compara
//   que tengan la misma forma.

export const COPY = {
  es: {
    htmlLang: "es",
    seo: {
      title: undefined, // usa el título por defecto de Seo.js
      description:
        "Gimnasio de escalada en Bucaramanga: MoonBoard 25° y 40°, placa principal y guiadas a roca natural. Entrena de 4 a 9 PM, de lunes a sábado. Todos los niveles.",
      keywords:
        "escalada Bucaramanga, gimnasio de escalada, rocódromo, MoonBoard, boulder, escalada en roca, climbing gym Colombia",
      path: "/",
      locale: "es_CO",
    },
    jsonLdDescription:
      "Gimnasio de escalada en Bucaramanga enfocado en entrenamiento real: rocódromo, boulder y MoonBoard.",
    nav: { home: "Home", services: "Servicios", pricing: "Precios", about: "Nosotros", openMenu: "Abrir menú" },
    langSwitch: { label: "EN", href: "/en", hrefLang: "en", title: "English version" },
    hero: {
      title: "Gimnasio de Escalada",
      location: "📍 Bucaramanga, Colombia · Roca natural · Guiadas en español & English",
      register: "REGISTRAR VISITA",
      mornings: "MAÑANAS (WA)",
      seeServices: "VER SERVICIOS",
      howItWorks: "CÓMO FUNCIONA",
    },
    services: {
      title: "Lo que hacemos",
      kicker: "Gimnasio · Entrenamiento · Guiadas en roca",
      gym: {
        tag: "GIMNASIO",
        name: "Entrenamiento Libre",
        desc: "Escala cuando quieras dentro del horario de tarde. MoonBoard a 25° y 40°, placa principal, enfoque en progreso real. Sin reserva previa — llegas y entrenas.",
        meta: "Lunes a Sábado · 4:00 PM – 9:00 PM",
        cta: "REGISTRAR VISITA",
      },
      training: {
        tag: "ENTRENAMIENTO",
        name: "Programación Enfocada",
        desc: "Fuerza de dedos, resistencia y técnica aplicada a la escalada. Rutinas diseñadas para escalar mejor en roca y placa. Para todos los niveles.",
        meta: "Incluido con acceso al gym",
        cta: "CÓMO FUNCIONA",
      },
      guided: {
        tag: "GUIADAS · TRIPS",
        name: "Escalada en Roca Real",
        desc: "Salidas a roca natural cerca de Bucaramanga. Grupos por nivel, logística incluida. Ideal para visitantes y extranjeros. Guías en español e inglés.",
        meta: "📍 Bucaramanga, Colombia · Sport climbing",
        cta: "ESCRIBIR POR WHATSAPP",
      },
    },
    prices: {
      title: "Precios",
      kicker: "Pago en efectivo o transferencia · Las guiadas a roca se cotizan por WhatsApp",
      day: {
        tag: "PASE DEL DÍA",
        name: "Un día de escalada",
        price: "$20.000",
        note: "sin zapatos",
        detail: "$30.000 con alquiler de pies de gato. Ideal para probar o para visitantes.",
        meta: "Acceso por el día · horario de tarde",
        cta: "REGISTRAR VISITA",
      },
      pack: {
        tag: "TICKETERA",
        name: "8 entradas",
        price: "$120.000",
        note: "· 8 visitas",
        detail: "$15.000 por visita. Para quien va seguido sin atarse a un mes.",
        meta: "Vigencia de 60 días",
        cta: "REGISTRAR VISITA",
      },
      month: {
        tag: "MENSUALIDAD",
        name: "Acceso ilimitado",
        price: "$120.000",
        note: "/ mes",
        detail: "$150.000 con pies de gato incluidos todo el mes. La mejor opción si entrenas constante.",
        meta: "Escala todos los días dentro del horario",
        cta: "EMPEZAR AHORA",
      },
    },
    about: {
      title: "CrashPath — Cómo entrenas hoy",
      kicker: "Ya no trabajamos por horas. Llegas, entrenas y te enfocas en tu progreso.",
      cardTitle: "Entrenamiento en CrashPath",
      p1: "CrashPath ahora es un gimnasio de escalada enfocado en entrenamiento real. Puedes escalar libremente dentro del horario de la tarde (**4:00 PM – 9:00 PM**), usando tanto la **MoonBoard** como nuestra **placa principal**.",
      p2: "Para mañanas, escríbenos por WhatsApp y coordinamos según disponibilidad.",
      bullets: [
        "Acceso libre en horario de tarde (4pm–9pm).",
        "MoonBoard a 25° y 40° disponible.",
        "Nueva placa principal de escalada.",
        "Enfoque en técnica, fuerza y resistencia.",
        "Para entrenar en la mañana: coordinación por WhatsApp.",
      ],
      register: "REGISTRAR VISITA",
      whatsapp: "WHATSAPP (MAÑANAS)",
    },
    footer: {
      line: "CrashPath · Bucaramanga · Gimnasio de Escalada y Entrenamiento",
      instagram: "IG @crash_path",
      whatsapp: "WhatsApp +57 320 8608016",
    },
  },

  en: {
    htmlLang: "en",
    seo: {
      title: "Climbing Gym in Bucaramanga, Colombia",
      description:
        "Climbing gym in Bucaramanga, Colombia: MoonBoard 25° & 40°, main wall and guided outdoor trips in English. Open 4–9 PM, Monday to Saturday. All levels.",
      keywords:
        "climbing gym Bucaramanga, climbing gym Colombia, bouldering Bucaramanga, MoonBoard Colombia, rock climbing Bucaramanga, guided climbing Colombia",
      path: "/en",
      locale: "en_US",
    },
    jsonLdDescription:
      "Climbing gym in Bucaramanga, Colombia focused on real training: bouldering, main wall and MoonBoard.",
    nav: { home: "Home", services: "Services", pricing: "Prices", about: "About", openMenu: "Open menu" },
    langSwitch: { label: "ES", href: "/", hrefLang: "es", title: "Versión en español" },
    hero: {
      title: "Climbing Gym",
      location: "📍 Bucaramanga, Colombia · Outdoor rock · Guided trips in English & Spanish",
      register: "REGISTER A VISIT",
      mornings: "MORNINGS (WA)",
      seeServices: "SEE SERVICES",
      howItWorks: "HOW IT WORKS",
    },
    services: {
      title: "What we do",
      kicker: "Gym · Training · Guided rock climbing",
      gym: {
        tag: "GYM",
        name: "Open Training",
        desc: "Climb whenever you like during the afternoon hours. MoonBoard at 25° and 40°, main wall, focus on real progress. No booking needed — just show up and train.",
        meta: "Monday to Saturday · 4:00 PM – 9:00 PM",
        cta: "REGISTER A VISIT",
      },
      training: {
        tag: "TRAINING",
        name: "Focused Programming",
        desc: "Finger strength, endurance and technique applied to climbing. Routines designed to help you climb better outdoors and on the wall. All levels welcome.",
        meta: "Included with gym access",
        cta: "HOW IT WORKS",
      },
      guided: {
        tag: "GUIDED · TRIPS",
        name: "Real Rock Climbing",
        desc: "Trips to natural rock near Bucaramanga. Groups by level, logistics included. Ideal for visitors and travelers. Guides in English and Spanish.",
        meta: "📍 Bucaramanga, Colombia · Sport climbing",
        cta: "MESSAGE US ON WHATSAPP",
      },
    },
    prices: {
      title: "Prices",
      kicker: "Pay in cash or by bank transfer · Prices in Colombian pesos (COP) · Guided rock trips are quoted on WhatsApp",
      day: {
        tag: "DAY PASS",
        name: "One day of climbing",
        price: "COP 20,000",
        note: "shoes not included",
        detail: "COP 30,000 with climbing shoe rental. Perfect to try us out or for visitors.",
        meta: "Day access · afternoon hours",
        cta: "REGISTER A VISIT",
      },
      pack: {
        tag: "PUNCH CARD",
        name: "8 entries",
        price: "COP 120,000",
        note: "· 8 visits",
        detail: "COP 15,000 per visit. For regulars who don't want to commit to a month.",
        meta: "Valid for 60 days",
        cta: "REGISTER A VISIT",
      },
      month: {
        tag: "MONTHLY",
        name: "Unlimited access",
        price: "COP 120,000",
        note: "/ month",
        detail: "COP 150,000 with climbing shoes included all month. The best option if you train consistently.",
        meta: "Climb every day during opening hours",
        cta: "START NOW",
      },
    },
    about: {
      title: "CrashPath — How you train now",
      kicker: "We no longer work by the hour. Show up, train and focus on your progress.",
      cardTitle: "Training at CrashPath",
      p1: "CrashPath is now a climbing gym focused on real training. You can climb freely during the afternoon hours (**4:00 PM – 9:00 PM**), using both the **MoonBoard** and our **main wall**.",
      p2: "For mornings, message us on WhatsApp and we'll arrange it based on availability.",
      bullets: [
        "Open access in the afternoon (4pm–9pm).",
        "MoonBoard at 25° and 40° available.",
        "New main climbing wall.",
        "Focus on technique, strength and endurance.",
        "To train in the morning: arrange it via WhatsApp.",
      ],
      register: "REGISTER A VISIT",
      whatsapp: "WHATSAPP (MORNINGS)",
    },
    footer: {
      line: "CrashPath · Bucaramanga · Climbing Gym & Training",
      instagram: "IG @crash_path",
      whatsapp: "WhatsApp +57 320 8608016",
    },
  },
};
