---
company: Buo
role: Arquitecto frontend líder
start: 2021-12-01
title: El frontend de Buo, de una persona a un equipo
summary: El frontend de Buo, de una persona a un equipo.
lede: Buo es una plataforma de analítica de personas con inteligencia artificial para empresas de México y Latinoamérica. Entré como el único desarrollador frontend; hoy lidero el equipo y la arquitectura de sus aplicaciones web.
facts:
  - label: Rol
    value: Arquitecto frontend líder
  - label: Desde
    value: diciembre de 2021
  - label: Antes
    value: Líder de frontend
  - label: Alcance
    value: Las aplicaciones web del producto
plates:
  - id: arquitectura
    short: Arquitectura
    lead: true
    title: Una arquitectura para todo el producto
    goal: Que las aplicaciones del producto funcionen como un solo producto y que cada una se pueda cambiar por su cuenta.
    approach: Creé la base técnica de las aplicaciones principales y una base de funcionalidades que comparten, y diseñé cómo se comunican entre sí. Dentro de cada aplicación definí un patrón de módulos que separa la interfaz de las reglas del negocio. También creé componentes reutilizables, como filtros avanzados, tableros con gráficos y tablas que recuerdan las preferencias de cada persona.
    result: El equipo construye sobre esa base y aplica los patrones por su cuenta. En los módulos nuevos, mi papel es revisar su arquitectura.
    practice: Arquitectura de aplicaciones
    figure: arch
    labels:
      app: aplicación
      talk: se comunican entre sí
      shared: base compartida
      inside: una aplicación, por dentro
      ui: interfaz · componentes reutilizables
      rules: reglas del negocio
      data: acceso a datos
      pattern: patrón de módulos
  - id: publicacion
    short: Publicación
    title: Cada aplicación se publica sola
    goal: Que cada aplicación del producto se publique de forma automática.
    approach: Diseñé un proceso de publicación automática para cada aplicación y un plan para adoptarlo por etapas, con la opción de volver atrás en cada una.
    result: Hoy todas las aplicaciones se publican de forma automática. Dirigí la adopción junto con el equipo de infraestructura y documenté cómo operar el proceso.
    practice: Entrega continua
    figure: deploy
    labels:
      change: Cambio
      app: aplicación
      each: cada una por su cuenta
      publish: Publicación
      auto: automática
      pilot: piloto
      oneByOne: una a una
      all: todas
      back: volver atrás en cada etapa
  - id: revision
    short: Revisión con IA
    title: Una primera revisión en minutos
    goal: Que cada cambio reciba una primera revisión rápida, para que la revisión del equipo se concentre en lo importante.
    approach: Un revisor con IA comenta cada cambio propuesto según criterios que el propio equipo define y ajusta.
    result: Cada cambio recibe una primera revisión en minutos.
    practice: Revisión de código asistida por IA
    figure: review
    labels:
      change: Cambio
      proposed: propuesto
      reviewer: Revisor con IA
      first: primera revisión
      criteria: criterios
      team: los define el equipo
      review: Revisión
      byTeam: del equipo
      minutes: minutos
  - id: decisiones
    short: Decisiones
    title: Decisiones escritas y verificables
    goal: Que las decisiones de arquitectura queden escritas y se puedan verificar.
    approach: 'El liderazgo técnico propuso documentar cada decisión de arquitectura, y lo adoptamos juntos. Documenté la base del frontend y agregué verificaciones automáticas en dos niveles: lo que se puede comprobar se exige, y la IA solo sugiere.'
    result: La arquitectura de cada aplicación está escrita junto a su código, y cada cambio se verifica contra ella.
    practice: Registros de decisiones de arquitectura
    figure: decisions
    labels:
      decisions: Decisiones
      written: escritas
      change: Cambio
      rules: Reglas
      enforced: se exigen
      ai: La IA
      suggests: solo sugiere
      levels: dos niveles
brief:
  title: La base común
  short: Base común
  items:
    - title: Modernización
      text: Propuse un plan de modernización del frontend con alternativas evaluadas, la dirección técnica lo aprobó y dirigí su primera fase.
    - title: Calidad
      text: Estandaricé las pruebas, las notas de versión y las guías de publicación en todas las aplicaciones.
    - title: Seguridad
      text: La seguridad es parte del proceso de cada cambio.
---
