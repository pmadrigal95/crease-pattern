---
company: Este sitio
role: Diseño y desarrollo
kind: project
start: 2026-10-01
title: Este sitio, un portafolio que se puede inspeccionar
summary: Un portafolio que se puede inspeccionar, donde cada número se mide al publicar.
lede: crease-pattern es este sitio, con mi portafolio y Precrease, el blog donde escribo sobre frontend. Lo diseño y lo construyo solo, en público, y lo que afirma se puede comprobar en su repositorio.
facts:
  - label: Rol
    value: Diseño y desarrollo
  - label: Desde
    value: octubre de 2026
  - label: Idiomas
    value: Español e inglés
  - label: Código
    value: Público, con licencia MIT
plates:
  - id: sistema
    short: Sistema de diseño
    lead: true
    title: Un sistema de diseño, tres identidades
    goal: Que el sitio pueda cambiar de identidad visual sin cambiar sus componentes, y que ninguna identidad pierda contraste.
    approach: Diseñé un sistema de tokens en tres niveles, con colores primitivos, tokens semánticos y tokens de componente. Las tres identidades comparten los mismos tokens semánticos y solo cambian sus colores primitivos. Cada una tiene además su propia figura de origami, doblada de la misma hoja cuadrada.
    result: Los componentes se escriben una sola vez para las tres identidades. Una prueba revisa cada color de texto y de interfaz contra WCAG 2.2 AA, en cada identidad, en claro y en oscuro.
    practice: Sistemas de diseño
    figure: system
    labels:
      primitives: colores primitivos, uno por identidad
      idA: Curvas de nivel
      idB: Basalto y glaciar
      idC: Washi y asagi
      semantic: Tokens semánticos
      same: los mismos en las tres
      components: Componentes
      contrast: contraste AA probado en cada tema
  - id: presupuestos
    short: Presupuestos
    title: Cada cambio pasa sus presupuestos
    goal: Que la calidad del sitio no dependa de acordarse de revisarla.
    approach: Escribí el nivel de calidad como datos, con presupuestos de peso para el JavaScript y umbrales de rendimiento y accesibilidad. Las pruebas, la integración continua y la sección «Este sitio, medido» del inicio leen esos mismos valores, así lo que el sitio dice de sí mismo y lo que se le exige no se pueden separar.
    result: Un cambio no se fusiona hasta pasar formato, tipos, pruebas, un escaneo de accesibilidad en cada identidad y tema, y los presupuestos de Lighthouse. Después se publica solo.
    practice: Presupuestos de rendimiento
    figure: gates
    labels:
      change: Cambio
      tests: pruebas
      a11y: accesibilidad
      perf: rendimiento
      weight: peso
      source: una sola fuente
      publish: Publicación
      auto: automática
      blocked: si una falla, no se fusiona
  - id: inspector
    short: Inspector
    title: La página explica cómo está hecha
    goal: Que quien visita pueda ver cómo está hecha la página que lee, sin abrir las herramientas del navegador.
    approach: Diseñé el Inspector, que separa la página en sus capas, muestra qué componente dibuja cada parte y lee sus métricas reales. Un manifiesto generado al compilar describe cada parte inspeccionable, y el panel se descarga solo cuando alguien lo abre.
    result: Las páginas del sitio se pueden inspeccionar, y quien no abre el Inspector no descarga su código.
    practice: Diseño de interacción
    figure: layers
    labels:
      page: Página
      interface: interfaz
      components: componentes
      metrics: métricas reales
      layers: capas
      onDemand: se descarga al abrirlo
  - id: solucionador
    short: Código de 2022
    title: Mi código de 2022, en el navegador
    goal: Que el solucionador que escribí en C en 2022 se pueda ejecutar dentro de un ensayo, sin instalar nada.
    approach: Compilé el código original a WebAssembly con el mismo algoritmo y solo cambié su entrada y su salida. El ensayo lo ejecuta en un hilo o en varios, y compara los tiempos en el dispositivo de quien lee.
    result: Quien lee el ensayo sobre hilos puede ejecutar el código de 2022. Si su navegador no permite varios hilos, el ensayo lo explica y lo ejecuta en uno.
    practice: Portabilidad de software
    figure: port
    labels:
      source: Código de 2022
      lang: C
      same: mismo algoritmo
      browser: Navegador
      serial: un hilo
      parallel: varios hilos
      io: solo cambian la entrada y la salida
brief:
  title: Lo que sostiene todo
  short: Base común
  items:
    - title: Accesibilidad
      text: Cada página pasa un escaneo automático de accesibilidad en cada identidad y tema, y Lighthouse le exige 100 en accesibilidad.
    - title: Seguridad
      text: Una política de seguridad de contenido estricta, para que el navegador solo ejecute los scripts que el sitio declara.
    - title: Dos idiomas
      text: Cada página existe en español y en inglés, y cada idioma tiene su propia búsqueda y su propio feed.
---
