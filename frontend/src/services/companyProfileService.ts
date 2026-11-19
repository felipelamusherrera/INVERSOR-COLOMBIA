import { supabase } from '../lib/supabase';
import type { StockRecord } from '../types/stock';

export interface RevenueMixSegment {
  productOrService: string;
  marketOrSector: string;
  revenueSharePct: number;
  competitors: string[];
  description: string;
}

export interface CompetitivePillar {
  title: string;
  moatMechanism: string;
  evidence: string;
}

export interface MacroFactorImpact {
  factor: string;
  sensitivity: 'Alta' | 'Media' | 'Favorable' | 'Directa';
  explanation: string;
}

export interface CompanyStrategicProfile {
  ticker: string;
  mission: string;
  vision: string;
  businessSummary: string;
  participatingMarkets: string[];
  revenueMix: RevenueMixSegment[];
  competitivePositionSummary: string;
  competitiveAdvantages: CompetitivePillar[];
  sectorFutureObjectives: string[];
  economicAndSocialImpact: string;
  macroFactors: MacroFactorImpact[];
  sectorRisks: string;
  sourceType: 'curated' | 'ai_enriched' | 'industry_model';
}

const PROFILE_CACHE_PREFIX = 'inversor_colombia_company_profile_v1_';
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CURATED_PROFILES: Record<string, Omit<CompanyStrategicProfile, 'ticker' | 'sourceType'>> = {
  APP: {
    mission: 'Impulsar el crecimiento rentable del ecosistema global de aplicaciones móviles y comercio conectado mediante motores de subasta publicitaria impulsados por IA.',
    vision: 'Consolidar a AXON como la infraestructura neuronal estándar para la adquisición de usuarios, monetización de inventario digital y atribución predictiva en tiempo real.',
    businessSummary: 'AppLovin opera una plataforma tecnológica de monetización y marketing digital basada en aprendizaje automático (motor AXON 2.0) orientada a desarrolladores de aplicaciones, editores móviles y anunciantes de e-commerce.',
    participatingMarkets: ['Publicidad Móvil Programática', 'AdTech & Mediación Digital', 'E-commerce Performance Ads', 'Gaming Móvil'],
    revenueMix: [
      {
        productOrService: 'Software Platform (AppDiscovery, AXON IA, MAX y Adjust)',
        marketOrSector: 'Publicidad Programática & E-commerce Digital',
        revenueSharePct: 72,
        competitors: ['Google AdMob / Google Ads', 'Meta Audience Network', 'Unity Grow (ironSource)', 'The Trade Desk'],
        description: 'Motor de puja en tiempo real (RTB), mediación in-app y atribución de campañas que optimizan el retorno sobre gasto publicitario (ROAS).',
      },
      {
        productOrService: 'Apps Portfolio & Monetización Directa (Ecosistema Móvil)',
        marketOrSector: 'Entretenimiento Móvil & Compras In-App',
        revenueSharePct: 28,
        competitors: ['Take-Two (Zynga)', 'Electronic Arts Mobile', 'Playtika', 'Tencent Games'],
        description: 'Portafolio de estudios propios y juegos móviles que además funcionan como laboratorio de datos de comportamiento para entrenar modelos AXON.',
      },
    ],
    competitivePositionSummary: 'A diferencia de redes publicitarias generalistas o agencias tradicionales de medios (como Omnicom o Publicis), AppLovin posee un bucle cerrado de datos de intención de compra in-app que realimenta los modelos predictivos de AXON 2.0, capturando presupuestos crecientes en gaming y comercio electrónico con mínima necesidad de capital humano adicional.',
    competitiveAdvantages: [
      {
        title: 'Motor Neuronal AXON 2.0',
        moatMechanism: 'Algoritmos propietarios de aprendizaje por refuerzo entrenados sobre miles de millones de subastas diarias.',
        evidence: 'Aumenta la tasa de conversión por impresión y eleva el ROAS de los anunciantes frente a redes heredadas.',
      },
      {
        title: 'Dominio en Mediación (MAX)',
        moatMechanism: 'Capa de software integrada en miles de apps que orquesta la subasta unificada entre todas las redes publicitarias.',
        evidence: 'Alta barrera de salida técnica: reemplazar el SDK de mediación compromete ingresos inmediatos del editor.',
      },
      {
        title: 'Escalabilidad de Software Puro',
        moatMechanism: 'Crecimiento de ingresos publicitarios sobre infraestructura automatizada sin incremento lineal de plantilla.',
        evidence: 'Expansión estructural de márgenes operativos muy por encima de agencias publicitarias tradicionales.',
      },
      {
        title: 'Expansión Vertical hacia Web & E-commerce',
        moatMechanism: 'Replicación de modelos de conversión de gaming hacia anunciantes directos de consumo y retail online.',
        evidence: 'Diversifica la base de demanda más allá de juegos móviles y amplía el mercado direccionable (TAM).',
      },
    ],
    sectorFutureObjectives: [
      'Automatización integral de campañas publicitarias basadas en IA generativa y puja predictiva orientada 100% a conversión verificada.',
      'Integración omnicanal entre inventario móvil in-app, Connected TV (CTV) y comercio electrónico directo al consumidor.',
      'Operación en entornos de privacidad estricta (SKAdNetwork y Privacy Sandbox) mediante modelado probabilístico de atribución sin cookies de terceros.',
    ],
    economicAndSocialImpact: 'Democratiza el crecimiento de pymes digitales, comercios electrónicos y estudios independientes de software, permitiéndoles escalar globalmente mediante adquisición eficiente de clientes sin requerir presupuestos masivos en medios tradicionales.',
    macroFactors: [
      {
        factor: 'Presupuestos Globales de Marketing Digital y Consumo',
        sensitivity: 'Alta',
        explanation: 'En ciclos expansivos las marcas incrementan gasto en adquisición de clientes (ROAS); desaceleraciones de consumo moderan CPMs.',
      },
      {
        factor: 'Tasas de Interés y Costo de Capital para Anunciantes',
        sensitivity: 'Media',
        explanation: 'Tasas más bajas reactivan inversión de venture capital y presupuestos de crecimiento en apps y retail digital.',
      },
      {
        factor: 'Políticas de Privacidad de Sistemas Operativos (Apple / Google)',
        sensitivity: 'Directa',
        explanation: 'Cambios en reglas de rastreo móvil (ATT / Privacy Sandbox) favorecen plataformas con datos propios y mejores modelos predictivos.',
      },
    ],
    sectorRisks: 'Dependencia de políticas de plataformas móviles (Apple App Store / Google Play), competencia directa de Meta y Google en presupuestos de e-commerce y eventual escrutinio antimonopolio en subastas AdTech.',
  },
  NVDA: {
    mission: 'Acelerar la computación científica, gráfica e inteligencia artificial a escala mundial mediante arquitecturas integradas de silicio, interconexión y software.',
    vision: 'Convertir cada centro de datos tradicional en una fábrica de inteligencia artificial capaz de generar tokens, simulación física y robótica autónoma.',
    businessSummary: 'NVIDIA diseña procesadores gráficos (GPU), aceleradores de centros de datos, chips de red de alta velocidad y la plataforma de software CUDA que sustenta la infraestructura moderna de IA generativa y computación acelerada.',
    participatingMarkets: ['Centros de Datos e IA Generativa', 'Videojuegos y Gráficos 3D', 'Visualización Profesional y Gemelos Digitales', 'Automoción Autónoma y Robótica'],
    revenueMix: [
      {
        productOrService: 'Data Center (GPUs Blackwell/Hopper, Networking InfiniBand/Spectrum-X, CUDA)',
        marketOrSector: 'Infraestructura Cloud e Inteligencia Artificial Empresarial',
        revenueSharePct: 87,
        competitors: ['AMD (Instinct MI300+)', 'Google TPU / AWS Trainium (ASICs propios)', 'Intel Gaudi', 'Broadcom (custom AI ASICs)'],
        description: 'Plataforma completa de cómputo acelerado y rack-scale para entrenamiento e inferencia de modelos fundacionales a escala hiperescalar.',
      },
      {
        productOrService: 'Gaming & AI PC (GeForce RTX)',
        marketOrSector: 'Consumo Gamer y Creadores Digitales',
        revenueSharePct: 9,
        competitors: ['AMD Radeon', 'Intel Arc', 'Apple Silicon (M-Series GPU)'],
        description: 'Tarjetas gráficas con trazado de rayos en tiempo real y aceleración DLSS/IA local para PCs.',
      },
      {
        productOrService: 'Professional Visualization, Automotive & Robotics (Omniverse, DRIVE, Jetson)',
        marketOrSector: 'Diseño Industrial, Manufactura y Conducción Autónoma',
        revenueSharePct: 4,
        competitors: ['Qualcomm Snapdragon Ride', 'Mobileye', 'AMD Embedded'],
        description: 'Simulación física en Omniverse y cómputo embarcado para robótica y flotas autónomas.',
      },
    ],
    competitivePositionSummary: 'Su liderazgo trasciende el diseño del chip individual: NVIDIA integra GPU, CPU (Grace), interconexión NVLink/Mellanox y más de 15 años de ecosistema CUDA con millones de desarrolladores, creando el mayor foso de costos de cambio en hardware de alto rendimiento.',
    competitiveAdvantages: [
      {
        title: 'Ecosistema Cerrado de Software CUDA',
        moatMechanism: 'Estándar de facto en bibliotecas, compiladores (cuDNN, TensorRT) y frameworks de IA.',
        evidence: 'Más de 5 millones de desarrolladores optimizan sus modelos nativamente sobre CUDA.',
      },
      {
        title: 'Integración Full-Stack (Silicio + Redes)',
        moatMechanism: 'Adquisición e integración de Mellanox (InfiniBand) y arquitectura NVLink para clústeres masivos.',
        evidence: 'Vende racks completos llave en mano (GB200 NVL72) en lugar de chips aislados.',
      },
      {
        title: 'Cadencia Anual de Innovación',
        moatMechanism: 'Ciclos anuales de arquitectura (Hopper → Blackwell → Rubin) que comprimen el costo por token.',
        evidence: 'Mantiene ventaja generacional frente a competidores con ciclos de 2 años.',
      },
      {
        title: 'Poder con Fundiciones (TSMC)',
        moatMechanism: 'Asignación prioritaria de nodos avanzados y empaquetado CoWoS a gran escala.',
        evidence: 'Asegura volumen de suministro frente a rivales de menor escala comercial.',
      },
    ],
    sectorFutureObjectives: [
      'Transición global de computación de propósito general (CPU) hacia computación acelerada e inferencia de IA agéntica.',
      'Reducción drástica de consumo energético por cálculo mediante arquitecturas refrigeradas por líquido a nivel de rack.',
      'Despliegue de IA Física: robótica humanoide, automatización industrial y conducción autónoma certificada.',
    ],
    economicAndSocialImpact: 'Acelera el descubrimiento científico (biología computacional, clima, nuevos materiales), eleva la productividad laboral en múltiples industrias y redefine la infraestructura energética y digital de los países.',
    macroFactors: [
      {
        factor: 'CapEx de Hiperescaladores (Microsoft, Alphabet, Meta, Amazon)',
        sensitivity: 'Alta',
        explanation: 'Su ritmo de ingresos depende directamente de la inversión anual en centros de datos de Big Tech y gobiernos.',
      },
      {
        factor: 'Controles de Exportación Geopolíticos y Restricciones Comerciales',
        sensitivity: 'Directa',
        explanation: 'Regulaciones de EE. UU. hacia mercados asiáticos restringen la venta de chips de máxima potencia.',
      },
      {
        factor: 'Disponibilidad Energética y Capacidad de Empaquetado Avanzado',
        sensitivity: 'Media',
        explanation: 'Cuellos de botella en subestaciones eléctricas o empaquetado CoWoS pueden limitar el ritmo de entregas.',
      },
    ],
    sectorRisks: 'Concentración de clientes en 4-5 grandes hiperescaladores, desarrollo interno de chips ASIC propios por parte de sus mismos clientes (Google, Amazon, Meta) y ciclicidad de CapEx en IA.',
  },
  AAPL: {
    mission: 'Ofrecer la mejor experiencia de usuario mediante hardware innovador, software integrado y servicios diseñados con foco en privacidad y accesibilidad.',
    vision: 'Fabricar los mejores productos del mundo de forma sostenible, integrando inteligencia personal útil directamente en la vida cotidiana.',
    businessSummary: 'Apple diseña y comercializa dispositivos electrónicos personales, silicio propietario (Apple Silicon) y un ecosistema creciente de servicios digitales recurrentes conectados sobre más de 2.2 mil millones de dispositivos activos.',
    participatingMarkets: ['Smartphones Premium', 'Computación Personal y Tablets', 'Servicios Digitales y Suscripciones', 'Wearables y Salud Digital'],
    revenueMix: [
      {
        productOrService: 'iPhone',
        marketOrSector: 'Telefonía Inteligente Premium Global',
        revenueSharePct: 52,
        competitors: ['Samsung Galaxy', 'Huawei', 'Xiaomi', 'Google Pixel'],
        description: 'Puerta de entrada principal al ecosistema iOS y generador de base instalada recurrente.',
      },
      {
        productOrService: 'Servicios (App Store, iCloud, Apple Pay, Music, TV+, Licencias)',
        marketOrSector: 'Economía Digital, Pagos y Suscripciones Cloud',
        revenueSharePct: 24,
        competitors: ['Google Play / Pay', 'Spotify', 'Netflix', 'Amazon Prime / AWS Cloud'],
        description: 'Segmento de mayor margen bruto (~70%+) y flujo recurrente que monetiza la base activa instalada.',
      },
      {
        productOrService: 'Mac & iPad',
        marketOrSector: 'Computación Personal y Productividad Profesional',
        revenueSharePct: 15,
        competitors: ['Lenovo', 'HP', 'Dell', 'Microsoft Surface', 'Samsung Tab'],
        description: 'Portátiles, desktops y tabletas potenciadas por chips propios Apple Silicon serie M.',
      },
      {
        productOrService: 'Wearables, Home & Accessories (Apple Watch, AirPods)',
        marketOrSector: 'Dispositivos Vestibles y Salud Conectada',
        revenueSharePct: 9,
        competitors: ['Garmin', 'Samsung Watch', 'Sony Audio', 'Meta Ray-Ban'],
        description: 'Accesorios integrados y monitoreo biométrico personal.',
      },
    ],
    competitivePositionSummary: 'Apple posee el ecosistema hardware-software-silicio más cohesionado del mercado de consumo: controlar desde el chip hasta el sistema operativo le permite tasas de retención superiores al 90% y un traspaso constante de usuarios hacia ingresos de servicios.',
    competitiveAdvantages: [
      {
        title: 'Efecto Red y Costo de Cambio del Ecosistema',
        moatMechanism: 'Continuidad nativa entre iPhone, Mac, Watch, iMessage, AirDrop e iCloud.',
        evidence: 'Altísima retención de usuarios al momento de renovar hardware cada 3-4 años.',
      },
      {
        title: 'Silicio Propietario (Series A y M)',
        moatMechanism: 'Diseño interno ARM optimizado para eficiencia energética y Apple Intelligence on-device.',
        evidence: 'Elimina dependencia de terceros en cómputo central y eleva márgenes hardware.',
      },
      {
        title: 'Monetización de Base Instalada (+2.2B Dispositivos)',
        moatMechanism: 'La división de Servicios convierte compradores únicos en suscriptores anuales recurrentes.',
        evidence: 'Reduce la volatilidad estacional de lanzamientos físicos.',
      },
      {
        title: 'Marca de Lujo Accesible y Poder de Precios',
        moatMechanism: 'Posicionamiento aspiracional que permite sostener precios promedio de venta (ASP) elevados.',
        evidence: 'Captura la mayoría de la utilidad operativa mundial de la industria móvil.',
      },
    ],
    sectorFutureObjectives: [
      'Despliegue de IA privada procesada directamente en el dispositivo (Edge AI) para asistencia contextual.',
      'Expansión de soluciones preventivas de salud digital y pagos financieros integrados.',
      'Diversificación geográfica de cadenas de suministro manufacturero (India, Vietnam) y neutralidad de carbono.',
    ],
    economicAndSocialImpact: 'Estructura una economía global de desarrolladores móviles de miles de millones en comercio digital, facilita pagos móviles sin contacto y extiende herramientas de salud personal preventiva (detección cardíaca/auditiva).',
    macroFactors: [
      {
        factor: 'Ingreso Disponible del Consumidor y Ciclos de Renovación',
        sensitivity: 'Media',
        explanation: 'Afecta la velocidad de actualización de dispositivos de gama alta en Norteamérica, Europa y China.',
      },
      {
        factor: 'Regulación Antimonopolio sobre App Store y Acuerdos de Búsqueda',
        sensitivity: 'Alta',
        explanation: 'Normativas como la DMA europea o fallos judiciales en EE. UU. presionan comisiones y pagos de licencias.',
      },
      {
        factor: 'Tensiones Arancelarias y Cadena de Suministro en Asia',
        sensitivity: 'Media',
        explanation: 'Cambios en aranceles entre EE. UU. y China o disrupciones de manufactura impactan costos unitarios.',
      },
    ],
    sectorRisks: 'Presión regulatoria sobre tarifas del App Store y acuerdos con Google Search, competencia local agresiva en China (Huawei) y madurez en los ciclos de reemplazo de smartphones.',
  },
  MSFT: {
    mission: 'Empoderar a cada persona y a cada organización del planeta para que logren más mediante productividad en la nube e inteligencia artificial confiable.',
    vision: 'Liderar la transformación hacia plataformas agénticas y computación en la nube híbrida que orquesten los procesos críticos de toda la economía empresarial.',
    businessSummary: 'Microsoft es el proveedor líder mundial de software corporativo, infraestructura en la nube (Azure), suites de productividad empresarial (Microsoft 365 + Copilot) y soluciones de datos, ciberseguridad y videojuegos.',
    participatingMarkets: ['Cloud Computing Corporativo (IaaS/PaaS)', 'Software de Productividad Empresarial (SaaS)', 'Bases de Datos y Analítica IA', 'Gaming & LinkedIn'],
    revenueMix: [
      {
        productOrService: 'Intelligent Cloud (Azure, SQL Server, GitHub, Enterprise Services)',
        marketOrSector: 'Infraestructura Cloud e Inteligencia Artificial Empresarial',
        revenueSharePct: 43,
        competitors: ['Amazon Web Services (AWS)', 'Google Cloud Platform (GCP)', 'Oracle Cloud (OCI)'],
        description: 'Principal motor de crecimiento, alojando cargas de trabajo empresariales y servicios Azure OpenAI.',
      },
      {
        productOrService: 'Productivity and Business Processes (Microsoft 365, Teams, Dynamics 365, LinkedIn)',
        marketOrSector: 'Software Corporativo SaaS y Red Profesional',
        revenueSharePct: 33,
        competitors: ['Google Workspace', 'Salesforce', 'Slack', 'SAP', 'Workday'],
        description: 'Licenciamiento recurrente por usuario con expansión adicional de ingreso promedio vía Copilot.',
      },
      {
        productOrService: 'More Personal Computing (Windows OEM, Gaming/Xbox/Activision, Search/Bing)',
        marketOrSector: 'Sistemas Operativos PC, Videojuegos y Publicidad',
        revenueSharePct: 24,
        competitors: ['Apple macOS', 'Sony PlayStation', 'Nintendo', 'Google Search'],
        description: 'Base histórica del sistema operativo Windows combinada con propiedad intelectual de videojuegos de primer nivel.',
      },
    ],
    competitivePositionSummary: 'Microsoft ocupa el centro neurálgico del departamento de TI de casi todas las empresas Fortune 500: su integración directa de identidad (Entra ID), ofimática (M365) y nube (Azure) permite realizar venta cruzada de Copilot y ciberseguridad sin fricción de adopción.',
    competitiveAdvantages: [
      {
        title: 'Distribución Corporativa Inigualable',
        moatMechanism: 'Contratos empresariales unificados (EA) que agrupan Office, Windows, Seguridad y Azure.',
        evidence: 'Permite monetizar nuevas herramientas de IA directamente sobre cientos de millones de asientos pagos.',
      },
      {
        title: 'Liderazgo en Nube Híbrida e IA Aplicada',
        moatMechanism: 'Alianza estratégica con OpenAI integrada en Azure y copilotos sectoriales.',
        evidence: 'Facilita que corporaciones desplieguen IA con cumplimiento normativo y privacidad de datos.',
      },
      {
        title: 'Altísimos Costos de Migración Empresarial',
        moatMechanism: 'Active Directory, flujos internos en Excel/ERP y arquitectura cloud profundamente arraigados.',
        evidence: 'Tasa de renovación contractual cercana al máximo de la industria software.',
      },
      {
        title: 'Escala de Ciberseguridad Integrada',
        moatMechanism: 'Ecosistema Defender/Sentinel alimentado por billones de señales diarias.',
        evidence: 'Negocio multibillonario que sustituye múltiples proveedores puntuales de seguridad.',
      },
    ],
    sectorFutureObjectives: [
      'Sustitución de software pasivo por agentes autónomos de IA integrados en flujos de trabajo (ERP, CRM y desarrollo de software).',
      'Expansión masiva de capacidad energética y centros de datos sostenibles libres de emisiones.',
      'Consolidación de plataformas unificadas de ciberseguridad frente a amenazas automatizadas.',
    ],
    economicAndSocialImpact: 'Eleva la productividad transversal de oficinas, gobiernos, hospitales y universidades; impulsa el desarrollo de software global mediante GitHub y facilita la empleabilidad profesional mediante LinkedIn.',
    macroFactors: [
      {
        factor: 'Presupuestos Corporativos de Tecnología (IT Spend)',
        sensitivity: 'Alta',
        explanation: 'Las expansiones o recortes en proyectos de transformación digital de grandes empresas guían el crecimiento de Azure.',
      },
      {
        factor: 'CapEx en Infraestructura IA y Depreciación de Servidores',
        sensitivity: 'Media',
        explanation: 'Las fuertes inversiones iniciales en GPUs y energía presionan temporalmente márgenes brutos hasta madurar su uso.',
      },
      {
        factor: 'Fluctuaciones del Dólar Estadounidense (FX)',
        sensitivity: 'Media',
        explanation: 'Al generar cerca de la mitad de sus ingresos fuera de EE. UU., un dólar muy fuerte reduce los ingresos reportados.',
      },
    ],
    sectorRisks: 'Retorno de inversión (ROI) corporativo más lento de lo esperado en licencias Copilot, competencia en nube frente a AWS/GCP y altos requerimientos anuales de CapEx.',
  },
  GOOGL: {
    mission: 'Organizar la información del mundo y hacerla universalmente accesible y útil mediante inteligencia artificial avanzada.',
    vision: 'Evolucionar desde un motor de búsqueda hacia un ecosistema inteligente multimedia, cloud y computacional (Gemini, Android, YouTube) presente en cada interacción digital.',
    businessSummary: 'Alphabet (Google) lidera la búsqueda web global, video online (YouTube), sistemas operativos móviles (Android), publicidad programática y un segmento cloud empresarial de rápido crecimiento (Google Cloud), junto a apuestas tecnológicas de largo plazo.',
    participatingMarkets: ['Búsqueda y Publicidad Digital', 'Streaming de Video y CTV', 'Cloud Computing Empresarial e IA', 'Conducción Autónoma (Waymo)'],
    revenueMix: [
      {
        productOrService: 'Google Search & Other Advertising Properties',
        marketOrSector: 'Publicidad de Intención Directa',
        revenueSharePct: 57,
        competitors: ['Amazon Ads', 'Meta Ads', 'Microsoft Bing', 'Buscadores IA (Perplexity/ChatGPT)'],
        description: 'Motor principal de flujo de caja mediante anuncios vinculados a búsquedas comerciales.',
      },
      {
        productOrService: 'YouTube Ads & Subscriptions + Google Network',
        marketOrSector: 'Video Digital, Connected TV y Audio Streaming',
        revenueSharePct: 20,
        competitors: ['Netflix', 'TikTok (ByteDance)', 'Meta Reels', 'Disney+ / Spotify'],
        description: 'Plataforma líder en consumo de video y televisión conectada en EE. UU. y el mundo.',
      },
      {
        productOrService: 'Google Cloud (GCP, Workspace, TPUs & Gemini API)',
        marketOrSector: 'Infraestructura Cloud Corporativa e IA',
        revenueSharePct: 12,
        competitors: ['Amazon AWS', 'Microsoft Azure', 'Snowflake', 'Databricks'],
        description: 'División de mayor expansión de margen operativo, apoyada en infraestructura propia de chips TPU.',
      },
      {
        productOrService: 'Android Ecosystem, Google Play, Hardware & Other Bets (Waymo)',
        marketOrSector: 'Ecosistema Móvil y Movilidad Autónoma',
        revenueSharePct: 11,
        competitors: ['Apple App Store', 'Tesla Robotaxi / Uber'],
        description: 'Distribución móvil global (más del 70% de cuota mundial OS) y liderazgo comercial en robotaxis Waymo.',
      },
    ],
    competitivePositionSummary: 'Alphabet combina el mayor volumen global de datos multimodales propios (Search, YouTube, Maps, Android) con integración vertical completa en hardware de IA (TPUs propias), permitiéndole entrenar y servir modelos Gemini a menor costo unitario que competidores dependientes de hardware externo.',
    competitiveAdvantages: [
      {
        title: 'Infraestructura Propia de Silicio TPU',
        moatMechanism: 'Diseño de procesadores Tensor propios para entrenamiento e inferencia interna de Gemini y GCP.',
        evidence: 'Reduce costos estructurales de cómputo por consulta frente a competidores.',
      },
      {
        title: 'Control de 7 Productos con +2B de Usuarios',
        moatMechanism: 'Search, YouTube, Chrome, Android, Gmail, Maps y Play generan efecto red inigualable.',
        evidence: 'Captura intención comercial inmediata desde descubrimiento hasta navegación.',
      },
      {
        title: 'Liderazgo en Streaming (YouTube)',
        moatMechanism: 'Combinación única de creadores, formato corto (Shorts), podcasts y TV en el hogar.',
        evidence: 'Mayor participación de tiempo de visualización televisiva en EE. UU. según Nielsen.',
      },
      {
        title: 'Pionero Comercial en Robotaxis (Waymo)',
        moatMechanism: 'Millones de viajes autónomos pagados operando en múltiples metrópolis.',
        evidence: 'Opción real de crecimiento en transporte autónomo con ventaja regulatoria de seguridad.',
      },
    ],
    sectorFutureObjectives: [
      'Transformación de la búsqueda clásica hacia respuestas generativas multimodales monetizables (AI Overviews).',
      'Captura acelerada de cuota empresarial en la nube mediante Vertex AI y soberanía de datos.',
      'Escalamiento comercial de flotas autónomas y reducción de fricción logística urbana.',
    ],
    economicAndSocialImpact: 'Conecta millones de comercios locales y creadores de contenido con audiencias globales de forma gratuita o de bajo costo, democratizando conocimiento educativo y navegación cartográfica mundial.',
    macroFactors: [
      {
        factor: 'Ciclo Publicitario Global y Confianza Comercial',
        sensitivity: 'Alta',
        explanation: 'Más del 75% de sus ingresos proviene de publicidad corporativa vinculada al dinamismo económico.',
      },
      {
        factor: 'Litigios Antimonopolio en EE. UU. y Europa',
        sensitivity: 'Directa',
        explanation: 'Resoluciones del DOJ sobre distribución de Search (Chrome/Apple) y AdTech pueden remodelar contratos.',
      },
      {
        factor: 'Intensidad de CapEx en Centros de Datos e IA',
        sensitivity: 'Media',
        explanation: 'El ritmo de inversión en servidores modera el flujo de caja libre de corto plazo a cambio de capacidad futura.',
      },
    ],
    sectorRisks: 'Posibles remedios regulatorios del Departamento de Justicia (DOJ), desplazamiento parcial de búsquedas informacionales hacia asistentes conversacionales externos y competencia de Amazon/TikTok en publicidad.',
  },
  AMZN: {
    mission: 'Ser la compañía más centrada en el cliente del planeta, ofreciendo la mayor selección, los precios más competitivos y entregas ultrarrápidas junto a infraestructura cloud de escala mundial.',
    vision: 'Automatizar integralmente la logística física mundial mediante robótica e IA mientras se consolida a AWS como la base operativa de la economía digital.',
    businessSummary: 'Amazon combina el liderazgo indiscutido en infraestructura de nube pública (AWS) con el mayor marketplace y red logística de comercio electrónico occidental, apalancando ese tráfico en un negocio publicitario de altísimo margen.',
    participatingMarkets: ['Infraestructura Cloud (AWS)', 'Comercio Electrónico y Logística', 'Publicidad Digital Retail Media', 'Streaming y Contenido Digital (Prime Video)'],
    revenueMix: [
      {
        productOrService: 'E-commerce Directo, Marketplace 3P & Logística FBA',
        marketOrSector: 'Comercio Electrónico Minorista y Logística',
        revenueSharePct: 72,
        competitors: ['Walmart', 'Shopify (ecosistema)', 'Costco', 'Target', 'Temu / Shein'],
        description: 'Venta directa y comisiones/fulfillment a millones de vendedores independientes sobre una red regionalizada.',
      },
      {
        productOrService: 'Amazon Web Services (AWS)',
        marketOrSector: 'Cloud Computing Corporativo e IA',
        revenueSharePct: 18,
        competitors: ['Microsoft Azure', 'Google Cloud', 'Oracle Cloud'],
        description: 'Principal motor de utilidad operativa de la compañía, impulsado por instancias Graviton/Trainium y Bedrock.',
      },
      {
        productOrService: 'Amazon Advertising & Prime Subscriptions',
        marketOrSector: 'Retail Media Ads y Membresías Digitales',
        revenueSharePct: 10,
        competitors: ['Google Ads', 'Meta', 'Walmart Connect', 'Netflix'],
        description: 'Publicidad patrocinada en el punto exacto de intención de compra con márgenes superiores al retail.',
      },
    ],
    competitivePositionSummary: 'Su volante de inercia combina densidad logística regional (entregas el mismo día que competidores no pueden igualar económicamente), membresía Prime de alta recurrencia y el liderazgo en cuota de mercado de AWS que financia la automatización robótica del comercio.',
    competitiveAdvantages: [
      {
        title: 'Red Logística Regionalizada y Robótica',
        moatMechanism: 'Centros de cumplimiento automatizados con cientos de miles de robots móviles propios.',
        evidence: 'Reduce el costo por unidad entregada y acorta plazos de entrega a horas.',
      },
      {
        title: 'Liderazgo Histórico en AWS',
        moatMechanism: 'Mayor cuota global en nube pública con chips propios (Graviton, Trainium) y catálogo Bedrock multi-modelo.',
        evidence: 'Genera la mayor fracción de flujo de caja libre operativo del grupo.',
      },
      {
        title: 'Retail Media Publicitario de Alta Conversión',
        moatMechanism: 'Anuncios mostrados a compradores con tarjeta lista dentro de la página de pago.',
        evidence: 'Retorno medible superior que impulsa expansión constante de margen operativo.',
      },
      {
        title: 'Membresía Prime Omnicanal',
        moatMechanism: 'Envíos gratuitos, Prime Video, música y beneficios agrupados en una sola cuota.',
        evidence: 'Eleva radicalmente la frecuencia anual de compra por hogar.',
      },
    ],
    sectorFutureObjectives: [
      'Automatización robótica total de almacenes y optimización predictiva de inventarios por IA.',
      'Cobertura de conectividad satelital (Project Kuiper) e IA generativa empresarial mediante AWS.',
      'Expansión de entregas farmacéuticas, comestibles y servicios B2B globales.',
    ],
    economicAndSocialImpact: 'Permite a cientos de miles de pymes acceder a logística de clase mundial (FBA), agiliza el abastecimiento de bienes esenciales en zonas urbanas y rurales, y reduce barreras para startups tecnológicas vía AWS.',
    macroFactors: [
      {
        factor: 'Consumo Minorista e Inflación de Fletes / Energía',
        sensitivity: 'Alta',
        explanation: 'Afecta tanto el volumen de órdenes discrecionales como el costo de transporte terrestre y aéreo.',
      },
      {
        factor: 'Adopción Corporativa de Cargas Cloud e IA',
        sensitivity: 'Alta',
        explanation: 'Determina la aceleración de ingresos y márgenes operativos de AWS.',
      },
      {
        factor: 'Costos Laborales y Sindicalización Logística',
        sensitivity: 'Media',
        explanation: 'Presiones salariales en centros de distribución se compensan gradualmente mediante automatización.',
      },
    ],
    sectorRisks: 'Competencia de bajo costo asiática (Temu/Shein), presión antimonopolio de la FTC en prácticas de marketplace y guerra de precios en servicios IA en la nube.',
  },
  PLTR: {
    mission: 'Dotar a las instituciones críticas de Occidente y a las grandes corporaciones con plataformas operativas de datos y toma de decisiones basadas en IA.',
    vision: 'Convertir la plataforma AIP (Artificial Intelligence Platform) en el sistema operativo central de las empresas modernas conectando modelos de lenguaje directamente con operaciones físicas.',
    businessSummary: 'Palantir desarrolla plataformas de software empresarial y gubernamental (Foundry, Gotham, Apollo y AIP) especializadas en integrar datos fragmentados en ontologías operativas accionables en tiempo real.',
    participatingMarkets: ['Software de Defensa e Inteligencia Gubernamental', 'IA Operativa Empresarial (AIP)', 'Cadenas de Suministro y Manufactura Digital'],
    revenueMix: [
      {
        productOrService: 'Commercial Platform (AIP & Foundry)',
        marketOrSector: 'Transformación Digital Corporativa e IA Empresarial',
        revenueSharePct: 46,
        competitors: ['Snowflake', 'Databricks', 'Microsoft Fabric', 'C3.ai', 'Consultoras IT (Accenture)'],
        description: 'Motor de expansión acelerada en EE. UU. mediante "Bootcamps" que pasan de piloto a producción en semanas.',
      },
      {
        productOrService: 'Government & Defense (Gotham & Apollo)',
        marketOrSector: 'Defensa, Inteligencia y Sector Público Occidental',
        revenueSharePct: 54,
        competitors: ['Anduril', 'Lockheed Martin Software', 'Booz Allen Hamilton', 'L3Harris'],
        description: 'Contratos plurianuales de misión crítica con acreditaciones máximas de seguridad (IL5/IL6).',
      },
    ],
    competitivePositionSummary: 'Mientras Snowflake o Databricks proveen almacenamiento y tuberías de datos, Palantir entrega la capa de Ontología: mapea bases dispersas directamente a decisiones físicas (rutas de fábrica, cadenas de suministro o mando militar) con auditoría de seguridad imposible de replicar rápidamente.',
    competitiveAdvantages: [
      {
        title: 'Arquitectura de Ontología Operativa',
        moatMechanism: 'Modela activos, plantas, clientes y reglas de negocio en un gemelo digital vivo.',
        evidence: 'Permite que LLMs ejecuten acciones seguras sin alucinaciones fuera de política.',
      },
      {
        title: 'Acreditaciones Gubernamentales de Máxima Seguridad',
        moatMechanism: 'Autorizaciones FedRAMP, IL5 e IL6 que toman años obtener a competidores entrantes.',
        evidence: 'Asegura retención casi total en contratos del Pentágono y aliados OTAN.',
      },
      {
        title: 'Estrategia Comercial "AIP Bootcamps"',
        moatMechanism: 'Despliegue práctico en vivo en 5 días sobre datos reales del cliente en lugar de ventas largas.',
        evidence: 'Acorta ciclos comerciales y dispara el crecimiento de clientes comerciales en EE. UU.',
      },
      {
        title: 'Sistema Continuo de Despliegue (Apollo)',
        moatMechanism: 'Opera software autónomamente en nubes privadas, satélites, submarinos o instalaciones desconectadas.',
        evidence: 'Diferenciador crítico para defensa y manufactura industrial.',
      },
    ],
    sectorFutureObjectives: [
      'Orquestación autónoma de cadenas de suministro, mantenimiento predictivo y operaciones financieras con agentes IA.',
      'Digitalización del campo de batalla y logística militar aliada mediante fusión multimodal de sensores.',
      'Estandarización de gobernanza y trazabilidad humana obligatoria sobre decisiones tomadas por IA.',
    ],
    economicAndSocialImpact: 'Mejora la eficiencia operativa en salud hospitalaria, manufactura aeroespacial y redes eléctricas, además de fortalecer las capacidades defensivas de países democráticos con estrictos controles de privacidad.',
    macroFactors: [
      {
        factor: 'Presupuestos de Defensa y Tensiones Geopolíticas Globales',
        sensitivity: 'Alta',
        explanation: 'Conflictos y modernización militar impulsan la adopción de software de comando y control.',
      },
      {
        factor: 'Inversión Corporativa en IA en Producción',
        sensitivity: 'Alta',
        explanation: 'El paso de pilotos experimentales de IA a plataformas productivas define su crecimiento comercial.',
      },
      {
        factor: 'Ciclos Presupuestarios Federales y Renovación de Contratos Públicos',
        sensitivity: 'Media',
        explanation: 'Demoras temporales en aprobaciones de presupuesto estatal pueden generar variaciones trimestrales.',
      },
    ],
    sectorRisks: 'Exigencia de valoración alta que penaliza cualquier desaceleración comercial, resistencia en adopción gubernamental europea frente a software estadounidense y ciclos de contratación pública.',
  },
  MU: {
    mission: 'Transformar la forma en que el mundo utiliza la información para enriquecer la vida mediante soluciones líderes de memoria y almacenamiento de datos.',
    vision: 'Ser el habilitador esencial de memoria de alto ancho de banda (HBM) y almacenamiento flash para la era ubicua de la inteligencia artificial.',
    businessSummary: 'Micron Technology es uno de los únicos tres fabricantes globales a escala en chips de memoria DRAM y almacenamiento NAND Flash, con rol estratégico crítico en memorias HBM3E/HBM4 para aceleradores de IA.',
    participatingMarkets: ['Centros de Datos e IA (HBM y DRAM Servidor)', 'Computación Personal y Smartphones', 'Automoción Conectada e Industria', 'Almacenamiento SSD Empresarial'],
    revenueMix: [
      {
        productOrService: 'DRAM & High Bandwidth Memory (HBM3E/HBM4 para Servidores IA)',
        marketOrSector: 'Memoria Volátil de Alto Rendimiento',
        revenueSharePct: 71,
        competitors: ['SK Hynix', 'Samsung Electronics Memory'],
        description: 'Núcleo de alta rentabilidad impulsado por requerimientos masivos de memoria en servidores de IA.',
      },
      {
        productOrService: 'NAND Flash & Enterprise SSDs',
        marketOrSector: 'Almacenamiento de Estado Sólido para Data Center y PC',
        revenueSharePct: 29,
        competitors: ['Samsung Electronics', 'SK Hynix / Solidigm', 'Western Digital / SanDisk', 'Kioxia'],
        description: 'Unidades SSD de alta capacidad optimizadas para lagos de datos y almacenamiento en nube.',
      },
    ],
    competitivePositionSummary: 'La industria de DRAM opera como un oligopolio global de tres actores (Samsung, SK Hynix y Micron) con barreras de inversión en fábricas (fabs) de decenas de miles de millones de dólares. El salto de Micron como único proveedor occidental líder en HBM3E/HBM4 le otorga tracción estructural sin precedentes.',
    competitiveAdvantages: [
      {
        title: 'Oligopolio Global de 3 Actores en DRAM',
        moatMechanism: 'Consolidación industrial de décadas y complejidad física extrema en nodos sub-10nm.',
        evidence: 'Impide la entrada de nuevos competidores sin inversiones superiores a $30B USD y décadas de I+D.',
      },
      {
        title: 'Eficiencia Energética Líder en HBM3E',
        moatMechanism: 'Arquitectura apilada 3D que consume ~30% menos energía que alternativas competidoras.',
        evidence: 'Validada y adoptada directamente por NVIDIA en plataformas H200 y Blackwell.',
      },
      {
        title: 'Respaldo Estratégico CHIPS Act (EE. UU.)',
        moatMechanism: 'Subvenciones y créditos fiscales para construcción de mega-fabs en Idaho y Nueva York.',
        evidence: 'Asegura soberanía de suministro de memoria estratégica dentro de Norteamérica.',
      },
      {
        title: 'Multiplicador de Contenido de Memoria por IA',
        moatMechanism: 'Cada servidor IA demanda 6x-8x más memoria DRAM y HBM que un servidor tradicional.',
        evidence: 'Absorbe capacidad fabril reduciendo sobreofertas cíclicas históricas.',
      },
    ],
    sectorFutureObjectives: [
      'Transición masiva hacia HBM4 con interconexión directa de lógica base y duplicación de ancho de banda.',
      'Incremento de densidad de almacenamiento y memoria en dispositivos móviles y PCs habilitados para IA local.',
      'Mayor disciplina de oferta de capital (CapEx) en el sector para suavizar ciclos históricos de precios.',
    ],
    economicAndSocialImpact: 'Provee el componente indispensable para almacenar y procesar el crecimiento exponencial de datos médicos, científicos, financieros y multimedia del planeta.',
    macroFactors: [
      {
        factor: 'Equilibrio Oferta/Demanda de Chips y Precios Spot DRAM/NAND',
        sensitivity: 'Alta',
        explanation: 'Su margen bruto fluctúa fuertemente con la disciplina de inventario del oligopolio y precios por gigabyte.',
      },
      {
        factor: 'CapEx en Infraestructura de Centros de Datos IA',
        sensitivity: 'Alta',
        explanation: 'Contratos anticipados de HBM determinan la visibilidad de ingresos a 12-18 meses.',
      },
      {
        factor: 'Ciclos Económicos en PCs, Smartphones y Sector Automotriz',
        sensitivity: 'Media',
        explanation: 'Recuperaciones en renovación de dispositivos de consumo complementan la demanda de servidores.',
      },
    ],
    sectorRisks: 'Naturaleza históricamente cíclica de precios de memoria cuando competidores sobreinvierten en capacidad, alta intensidad de CapEx anual y exposición geopolítica en plantas asiáticas.',
  },
};

function buildIndustryGroundedProfile(
  stock: StockRecord,
  peers: StockRecord[]
): CompanyStrategicProfile {
  const ticker = stock.ticker.toUpperCase();
  const company = stock.company || ticker;
  const sector = stock.sector || 'Mercado Bursátil Global';
  const industry = stock.industry || sector;
  const peerNames = peers.slice(0, 3).map((p) => `${p.company || p.ticker} (${p.ticker})`);
  const rivalListA = peerNames.slice(0, 2).length > 0 ? peerNames.slice(0, 2) : ['Líderes globales del segmento', 'Especialistas regionales'];
  const rivalListB = peerNames.length > 0 ? peerNames : ['Proveedores integrados del sector'];

  const secLow = sector.toLowerCase();
  const indLow = industry.toLowerCase();

  if (indLow.includes('semiconductor') || indLow.includes('electronic')) {
    return {
      ticker,
      mission: `Diseñar y proveer soluciones de silicio, componentes electrónicos e infraestructura de cómputo de alta eficiencia para habilitar la transformación digital en ${industry}.`,
      vision: `Consolidarse como socio tecnológico esencial en la cadena de valor de semiconductores y electrónica avanzada mediante innovación continua en densidad, eficiencia energética y confiabilidad.`,
      businessSummary: `${company} desarrolla y comercializa dispositivos semiconductores, equipamiento especializado y soluciones integradas orientadas a centros de datos, conectividad industrial, consumo avanzado y automatización.`,
      participatingMarkets: ['Infraestructura Digital y Cloud', 'Electrónica Industrial y Automoción', 'Dispositivos Conectados y B2B'],
      revenueMix: [
        {
          productOrService: `Plataforma Principal en ${industry}`,
          marketOrSector: 'Clientes Empresariales e Hiperescalares',
          revenueSharePct: 62,
          competitors: rivalListA,
          description: `Línea core de componentes, sistemas o propiedad intelectual de alto margen adaptada a requisitos de rendimiento críticos.`,
        },
        {
          productOrService: 'Aplicaciones Industriales, Automotrices y Conectividad',
          marketOrSector: 'Manufactura, Energía y Movilidad',
          revenueSharePct: 24,
          competitors: rivalListB,
          description: 'Soluciones de largo ciclo de vida con contratos de calificación técnica multi-anual.',
        },
        {
          productOrService: 'Soporte Técnico, Licencias y Módulos Complementarios',
          marketOrSector: 'Ecosistema de Integradores OEM',
          revenueSharePct: 14,
          competitors: ['Proveedores OEM / ODM regionales'],
          description: 'Software de control, diseño personalizado y servicios recurrentes de postventa.',
        },
      ],
      competitivePositionSummary: `Dentro de ${industry}, la posición competitiva de ${company} se fundamenta en propiedad intelectual protegida por patentes, largos ciclos de calificación con clientes OEM y economías de escala fabril o de diseño que elevan sustancialmente el costo de reemplazo frente a ${rivalListA[0]}.`,
      competitiveAdvantages: [
        {
          title: 'Propiedad Intelectual y Ciclo de Calificación',
          moatMechanism: 'Diseños patentados integrados directamente en las tarjetas o sistemas finales del cliente.',
          evidence: 'Una vez validado en producción ("design-in"), genera ingresos recurrentes durante varios años.',
        },
        {
          title: 'Barreras de Inversión en I+D y Capacidad',
          moatMechanism: 'Requerimientos intensivos de ingeniería física y acuerdos estratégicos de fundición.',
          evidence: 'Limita la entrada de competidores de bajo costo en segmentos de alta especificación.',
        },
        {
          title: 'Diversificación de Aplicaciones Finales',
          moatMechanism: 'Exposición balanceada entre infraestructura digital, industria y consumo especializado.',
          evidence: 'Mitiga la dependencia exclusiva de un solo comprador OEM.',
        },
        {
          title: 'Optimización de Rendimiento por Vatio',
          moatMechanism: 'Mejora generacional en eficiencia térmica y consumo eléctrico.',
          evidence: 'Prioridad crítica en compradores de centros de datos y sistemas embarcados.',
        },
      ],
      sectorFutureObjectives: [
        'Miniaturización continua de nodos, empaquetado avanzado 3D y mayor eficiencia energética en cargas de IA y electrificación.',
        'Regionalización y resiliencia de cadenas de suministro en Norteamérica, Europa y aliados estratégicos.',
        'Integración nativa de software y sensores inteligentes en el borde (Edge Computing).',
      ],
      economicAndSocialImpact: 'Sostiene toda la infraestructura física detrás de telecomunicaciones, energías limpias, automatización médica e industria automotriz eléctrica, elevando productividad y seguridad.',
      macroFactors: [
        { factor: 'Ciclo Global de Inventarios y CapEx Tecnológico', sensitivity: 'Alta', explanation: 'Los pedidos de distribuidores y centros de datos marcan la expansión o ajuste de márgenes.' },
        { factor: 'Geopolítica Comercial y Controles de Exportación', sensitivity: 'Directa', explanation: 'Aranceles o restricciones entre bloques económicos redefinen rutas de venta y manufactura.' },
        { factor: 'Costo de Capital y Tasas de Interés Industriales', sensitivity: 'Media', explanation: 'Influye en la velocidad de proyectos de automatización y electrificación en clientes finales.' },
      ],
      sectorRisks: `Ciclicidad de demanda en semiconductores, concentración en clientes OEM clave y presiones geopolíticas sobre manufactura en ${industry}.`,
      sourceType: 'industry_model',
    };
  }

  if (secLow.includes('health') || indLow.includes('pharma') || indLow.includes('biotech') || indLow.includes('medical')) {
    return {
      ticker,
      mission: `Investigar, desarrollar y proveer terapias médicas o tecnologías sanitarias innovadoras orientadas a mejorar la supervivencia y calidad de vida de los pacientes.`,
      vision: `Liderar soluciones clínicas de precisión en ${industry} mediante ciencia traslacional, seguridad terapéutica y acceso sostenible para los sistemas de salud.`,
      businessSummary: `${company} opera en el ecosistema de salud desarrollando soluciones clínicas, equipamiento diagnóstico o terapias especializadas respaldadas por aprobaciones regulatorias y protección de propiedad intelectual.`,
      participatingMarkets: ['Sistemas Hospitalarios y Clínicos', 'Farmacia Especializada y Terapias Crónicas', 'Diagnóstico y Tecnología Médica'],
      revenueMix: [
        {
          productOrService: `Portafolio Clínico / Terapéutico Principal (${industry})`,
          marketOrSector: 'Hospitales, Aseguradoras y Farmacia Especializada',
          revenueSharePct: 68,
          competitors: rivalListA,
          description: 'Productos insignia con protección de patente o adopción estándar en protocolos médicos.',
        },
        {
          productOrService: 'Líneas Complementarias, Diagnóstico y Consumibles',
          marketOrSector: 'Atención Ambulatoria y Laboratorios',
          revenueSharePct: 22,
          competitors: rivalListB,
          description: 'Ingresos recurrentes derivados de pruebas, dosificación continua o mantenimiento clínico.',
        },
        {
          productOrService: 'Alianzas de Licenciamiento y Mercados Internacionales',
          marketOrSector: 'Redes de Salud Globales',
          revenueSharePct: 10,
          competitors: ['Proveedores internacionales y genéricos'],
          description: 'Expansión comercial mediante acuerdos regionales y nuevas indicaciones aprobadas.',
        },
      ],
      competitivePositionSummary: `El foso competitivo de ${company} descansa en patentes clínicas de largo plazo, aprobaciones de agencias sanitarias (FDA/EMA) y evidencia médica contrastada frente a ${rivalListA[0]}, lo que protege sus precios ante presiones económicas.`,
      competitiveAdvantages: [
        { title: 'Protección de Patentes y Exclusividad Regulatoria', moatMechanism: 'Años de ensayos clínicos fase I-III y registro sanitario.', evidence: 'Impide la copia directa durante la vigencia comercial de la patente.' },
        { title: 'Demanda Inelástica al Ciclo Económico', moatMechanism: 'Tratamientos e insumos médicos esenciales no postergables.', evidence: 'Estabilidad relativa de ingresos incluso en desaceleraciones.' },
        { title: 'Red de Distribución Clínica y Médica', moatMechanism: 'Relación institucional con aseguradoras, hospitales y especialistas.', evidence: 'Facilita el lanzamiento rápido de nuevas terapias del pipeline.' },
        { title: 'Pipeline de Innovación I+D', moatMechanism: 'Reinversión disciplinada de caja en nuevas moléculas o dispositivos.', evidence: 'Reemplaza ingresos ante futuros vencimientos de patentes.' },
      ],
      sectorFutureObjectives: [
        'Medicina personalizada, terapias dirigidas por biomarcadores e integración de IA en descubrimiento clínico y diagnóstico.',
        'Reducción de tiempos hospitalarios mediante procedimientos mínimamente invasivos y monitoreo remoto.',
        'Ampliación de cobertura y eficiencia en costos para sistemas públicos y privados de salud.',
      ],
      economicAndSocialImpact: 'Incrementa la esperanza y calidad de vida poblacional, reduce costos indirectos por ausentismo laboral y hospitalizaciones prolongadas.',
      macroFactors: [
        { factor: 'Regulación de Precios de Medicamentos y Reembolsos (Medicare/CMS)', sensitivity: 'Alta', explanation: 'Reformas gubernamentales en negociación de precios impactan directamente márgenes.' },
        { factor: 'Tasas de Interés y Financiamiento Biotecnológico', sensitivity: 'Media', explanation: 'Condiciones financieras determinan el ritmo de ensayos clínicos, fusiones y adquisiciones (M&A).' },
        { factor: 'Envejecimiento Demográfico Global', sensitivity: 'Favorable', explanation: 'Tendencia estructural de largo plazo que eleva continuamente la demanda sanitaria.' },
      ],
      sectorRisks: 'Riesgo binario en resultados de ensayos clínicos, vencimiento de patentes (patent cliff) y presiones regulatorias sobre precios de reembolso.',
      sourceType: 'industry_model',
    };
  }

  if (secLow.includes('financial') || indLow.includes('bank') || indLow.includes('insurance') || indLow.includes('credit') || indLow.includes('capital markets')) {
    return {
      ticker,
      mission: `Proveer servicios financieros, gestión de riesgos, pagos o intermediación de capital con máxima solidez patrimonial, transparencia y eficiencia tecnológica.`,
      vision: `Consolidar plataformas financieras digitales de alta confianza que conecten ahorro, crédito y liquidez global para personas e instituciones.`,
      businessSummary: `${company} desarrolla actividades financieras especializadas en ${industry}, combinando generación de ingresos por márgenes financieros, comisiones recurrentes por servicios, suscripciones de datos o suscripción de riesgos.`,
      participatingMarkets: ['Banca / Crédito Corporativo e Individual', 'Mercados de Capitales y Gestión Patrimonial', 'Pagos Digitales y Datos Financieros'],
      revenueMix: [
        {
          productOrService: `Operación Central en ${industry}`,
          marketOrSector: 'Clientes Corporativos, Institucionales y Retail',
          revenueSharePct: 60,
          competitors: rivalListA,
          description: 'Fuente principal de ingresos financieros netos o comisiones sobre volumen administrado.',
        },
        {
          productOrService: 'Servicios por Comisiones, Plataformas Tecnológicas y Asesoría',
          marketOrSector: 'Empresas, Comercios y Gestores',
          revenueSharePct: 28,
          competitors: rivalListB,
          description: 'Flujos con menor intensidad de capital vinculados a transaccionalidad y software financiero.',
        },
        {
          productOrService: 'Tesorería, Productos Estructurados y Coberturas',
          marketOrSector: 'Mercado Institucional',
          revenueSharePct: 12,
          competitors: ['Instituciones financieras globales'],
          description: 'Gestión de liquidez, balances de inversión y servicios auxiliares.',
        },
      ],
      competitivePositionSummary: `${company} compite mediante escala de balance, eficiencia operativa y costos bajos de fondeo o distribución de red frente a ${rivalListA[0]}, respaldada por estrictos marcos de cumplimiento regulatorio que dificultan la entrada de actores sin licencia.`,
      competitiveAdvantages: [
        { title: 'Licencias Regulatorias y Confianza de Marca', moatMechanism: 'Supervisión prudencial y requisitos de capital exigidos por bancos centrales y reguladores.', evidence: 'Barrera legal y fiduciaria frente a nuevos entrantes.' },
        { title: 'Efecto Red y Escala de Distribución', moatMechanism: 'Base amplia de cuentas, depósitos o comercios afiliados que reduce el costo de adquisición.', evidence: 'Impulsa venta cruzada de múltiples productos financieros.' },
        { title: 'Digitalización Operativa y Riesgo Cuantitativo', moatMechanism: 'Modelos estadísticos y automatización de originación y prevención de fraude.', evidence: 'Controla pérdidas crediticias y mejora el índice de eficiencia.' },
        { title: 'Recurrencia de Comisiones', moatMechanism: 'Flujos ligados a custodia, transacciones o analítica continua.', evidence: 'Suaviza la sensibilidad frente a cambios en tasas de interés.' },
      ],
      sectorFutureObjectives: [
        'Digitalización total de pagos en tiempo real, modernización de infraestructura bancaria y uso de IA para análisis de riesgo y fraude.',
        'Integración fluida entre servicios financieros embebidos (Embedded Finance) y plataformas comerciales.',
        'Fortalecimiento continuo de métricas de solvencia, liquidez y ciberseguridad institucional.',
      ],
      economicAndSocialImpact: 'Canaliza el ahorro hacia inversión productiva, facilita acceso a vivienda, crédito empresarial y medios de pago seguros que formalizan la economía.',
      macroFactors: [
        { factor: 'Política Monetaria y Curva de Tasas de Interés (FED)', sensitivity: 'Alta', explanation: 'Altera el margen neto de interés, costo de fondeo y volumen de originación de crédito.' },
        { factor: 'Empleo, Morosidad y Calidad Crediticia', sensitivity: 'Directa', explanation: 'Desaceleraciones económicas elevan provisiones por pérdidas esperadas en cartera.' },
        { factor: 'Actividad de Mercados de Capitales y M&A', sensitivity: 'Media', explanation: 'Mayor volatilidad o reapertura de emisiones impulsa comisiones de intermediación.' },
      ],
      sectorRisks: 'Deterioro de calidad crediticia en ciclos recesivos, compresión de márgenes ante recortes rápidos de tasas, competencia Fintech y mayores exigencias regulatorias de capital.',
      sourceType: 'industry_model',
    };
  }

  return {
    ticker,
    mission: `Entregar soluciones especializadas de alto valor agregado dentro de ${industry}, optimizando la eficiencia, confiabilidad y retorno operativo para sus clientes institucionales y comerciales.`,
    vision: `Consolidar una posición líder y sostenible dentro del sector ${sector}, integrando tecnología, disciplina operativa y expansión en mercados de mayor crecimiento.`,
    businessSummary: `${company} desarrolla su actividad principal dentro de ${industry} (sector ${sector}), ofreciendo productos y servicios especializados orientados a resolver necesidades críticas de sus clientes en múltiples mercados.`,
    participatingMarkets: [industry, sector, 'Clientes Corporativos & Distribución Especializada'],
    revenueMix: [
      {
        productOrService: `Línea Core Especializada en ${industry}`,
        marketOrSector: `Segmento Principal (${sector})`,
        revenueSharePct: 64,
        competitors: rivalListA,
        description: 'Oferta principal de productos o plataformas donde la compañía concentra su mayor participación de mercado y diferenciación técnica.',
      },
      {
        productOrService: 'Soluciones Complementarias, Contratos Recurrentes y Servicios',
        marketOrSector: 'Base Instalada de Clientes Empresariales / Consumo',
        revenueSharePct: 24,
        competitors: rivalListB,
        description: 'Servicios de valor agregado, consumibles, suscripciones o mantenimiento vinculados al producto principal.',
      },
      {
        productOrService: 'Expansión Geográfica y Nuevas Verticales de Crecimiento',
        marketOrSector: 'Mercados Adyacentes e Internacionales',
        revenueSharePct: 12,
        competitors: ['Actores regionales especializados'],
        description: 'Líneas emergentes destinadas a ampliar el mercado direccionable y capturar nuevas oportunidades.',
      },
    ],
    competitivePositionSummary: `En la industria de ${industry}, ${company} se diferencia frente a competidores directos como ${rivalListA.join(' y ')} mediante su escala operativa, reputación comercial y capacidad de ejecución integrada entre oferta principal y servicios asociados.`,
    competitiveAdvantages: [
      {
        title: `Especialización en ${industry}`,
        moatMechanism: 'Conocimiento técnico acumulado y procesos adaptados a las exigencias específicas de su nicho.',
        evidence: 'Genera preferencia comercial frente a proveedores generalistas sin foco sectorial.',
      },
      {
        title: 'Escala de Distribución y Abastecimiento',
        moatMechanism: 'Relaciones consolidadas con proveedores y canales comerciales de alcance amplio.',
        evidence: 'Mejora la estructura de costos unitarios y tiempos de respuesta al cliente.',
      },
      {
        title: 'Relaciones Contractuales y Costo de Cambio',
        moatMechanism: 'Integración de sus productos o servicios dentro de la operación continua de los compradores.',
        evidence: 'Sostiene recurrencia comercial y visibilidad de ingresos entre ejercicios.',
      },
      {
        title: 'Disciplina de Asignación de Capital',
        moatMechanism: 'Balance entre reinversión operativa en crecimiento rentable y eficiencia de activos.',
        evidence: 'Permite defender la competitividad a lo largo de distintos momentos del ciclo.',
      },
    ],
    sectorFutureObjectives: [
      `Digitalización, automatización operativa y adopción de analítica avanzada/IA aplicada a ${industry}.`,
      'Transición hacia cadenas de suministro más resilientes y estándares superiores de eficiencia energética y sostenibilidad.',
      'Consolidación de mercado mediante integración vertical y soluciones integrales orientadas al cliente.',
    ],
    economicAndSocialImpact: `Contribuye al empleo formal, encadenamientos productivos con pymes proveedoras y continuidad de servicios o bienes esenciales dentro de ${sector}.`,
    macroFactors: [
      {
        factor: 'Tasas de Interés y Condiciones Financieras Globales',
        sensitivity: 'Media',
        explanation: 'Afectan el costo de financiamiento de capital de trabajo, proyectos de expansión y valoración relativa.',
      },
      {
        factor: 'Dinámica de Demanda, Inflación de Insumos y Energía',
        sensitivity: 'Alta',
        explanation: 'Variaciones en costos logísticos, salarios o materias primas exigen capacidad de traspaso a precios.',
      },
      {
        factor: 'Regulación Sectorial y Comercio Internacional',
        sensitivity: 'Media',
        explanation: 'Políticas fiscales, ambientales o arancelarias reconfiguran la competitividad regional en el sector.',
      },
    ],
    sectorRisks: `Intensificación competitiva de precios en ${industry}, presiones inflacionarias sobre costos operativos y desaceleración macroeconómica que modere la demanda.`,
    sourceType: 'industry_model',
  };
}

/**
 * Retorna de forma sincrónica el perfil empresarial más preciso disponible:
 * 1) Caché enriquecido por IA en localStorage
 * 2) Base curada por ticker (NVDA, AAPL, MSFT, GOOGL, AMZN, APP, PLTR, MU, etc.)
 * 3) Modelo contextual por industria y competidores reales
 */
export function getImmediateCompanyProfile(
  stock: StockRecord,
  peers: StockRecord[]
): CompanyStrategicProfile {
  const ticker = stock.ticker.toUpperCase();

  if (typeof window !== 'undefined') {
    try {
      const cachedRaw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${ticker}`);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { timestamp: number; profile: CompanyStrategicProfile };
        if (cached?.profile && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return cached.profile;
        }
      }
    } catch {
      // noop
    }
  }

  const curated = CURATED_PROFILES[ticker];
  if (curated) {
    return {
      ticker,
      ...curated,
      sourceType: 'curated',
    };
  }

  return buildIndustryGroundedProfile(stock, peers);
}

function extractJsonObject(raw: string): any | null {
  try {
    return JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(raw.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Solicita al backend IA (Gemini vía /api/agent/chat o Supabase Edge Function agent-chat)
 * el perfil empresarial específico (misión, visión, productos con % peso, competidores y factores macro)
 * para cualquier acción no curada manualmente, y lo almacena en caché local.
 */
export async function fetchAIEnrichedCompanyProfile(
  stock: StockRecord,
  peers: StockRecord[],
  forceRefresh = false
): Promise<CompanyStrategicProfile | null> {
  const ticker = stock.ticker.toUpperCase();

  if (!forceRefresh && CURATED_PROFILES[ticker]) {
    return {
      ticker,
      ...CURATED_PROFILES[ticker],
      sourceType: 'curated',
    };
  }

  if (!forceRefresh && typeof window !== 'undefined') {
    try {
      const cachedRaw = localStorage.getItem(`${PROFILE_CACHE_PREFIX}${ticker}`);
      if (cachedRaw) {
        const cached = JSON.parse(cachedRaw) as { timestamp: number; profile: CompanyStrategicProfile };
        if (cached?.profile && Date.now() - cached.timestamp < CACHE_TTL_MS) {
          return cached.profile;
        }
      }
    } catch {
      // noop
    }
  }

  const peersLabel = peers.slice(0, 4).map((p) => `${p.company} (${p.ticker})`).join(', ') || 'competidores del sector';
  const prompt = `Genera ÚNICAMENTE un JSON válido (sin texto adicional ni markdown) en español para la empresa ${stock.company} (${ticker}), sector ${stock.sector || 'N/A'}, industria ${stock.industry || 'N/A'}, rivales detectados: ${peersLabel}.
Estructura exacta requerida:
{
  "mission": "Misión real y específica de la empresa (1-2 frases, sin ratios financieros)",
  "vision": "Visión estratégica real a futuro de la empresa (1-2 frases)",
  "businessSummary": "A qué se dedica exactamente la empresa y cómo opera su modelo de negocio (2-3 frases sin repetir métricas de precios)",
  "participatingMarkets": ["Mercado 1", "Mercado 2", "Mercado 3"],
  "revenueMix": [
    {
      "productOrService": "Nombre del producto/servicio o segmento principal",
      "marketOrSector": "Mercado específico donde compite",
      "revenueSharePct": 60,
      "competitors": ["Rival real 1", "Rival real 2"],
      "description": "Explicación concreta de qué vende en este segmento"
    }
  ],
  "competitivePositionSummary": "Análisis propio de la ventaja competitiva (foso económico) y posición frente a rivales",
  "competitiveAdvantages": [
    { "title": "Pilar 1 específico de la empresa", "moatMechanism": "Cómo protege su ventaja", "evidence": "Evidencia operativa real" },
    { "title": "Pilar 2 específico", "moatMechanism": "...", "evidence": "..." },
    { "title": "Pilar 3 específico", "moatMechanism": "...", "evidence": "..." },
    { "title": "Pilar 4 específico", "moatMechanism": "...", "evidence": "..." }
  ],
  "sectorFutureObjectives": ["Objetivo estratégico del sector 1", "Objetivo 2", "Objetivo 3"],
  "economicAndSocialImpact": "Cómo impacta este sector y empresa en la economía y sociedad",
  "macroFactors": [
    { "factor": "Factor macroeconómico 1", "sensitivity": "Alta", "explanation": "Cómo la afecta" },
    { "factor": "Factor macroeconómico 2", "sensitivity": "Media", "explanation": "Cómo la afecta" },
    { "factor": "Factor macroeconómico 3", "sensitivity": "Directa", "explanation": "Cómo la afecta" }
  ],
  "sectorRisks": "Principales riesgos regulatorios, tecnológicos y competitivos específicos del sector"
}`;

  let rawReply = '';
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;

    const serverRes = await fetch('/api/agent/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        message: prompt,
        activeTicker: ticker,
        intent: 'stock_diagnosis',
        ragPromptContext: `Ticker: ${ticker}, Empresa: ${stock.company}, Sector: ${stock.sector}, Industria: ${stock.industry}`,
      }),
    }).catch(() => null);

    if (serverRes && serverRes.ok) {
      const json = await serverRes.json();
      if (json?.reply && !json?.useDeterministicEngine) {
        rawReply = json.reply;
      }
    }

    if (!rawReply) {
      const { data: edgeData, error: edgeErr } = await supabase.functions.invoke('agent-chat', {
        body: {
          message: prompt,
          activeTicker: ticker,
          intent: 'stock_diagnosis',
          ragPromptContext: `Ticker: ${ticker}, Empresa: ${stock.company}, Sector: ${stock.sector}, Industria: ${stock.industry}`,
        },
      });
      if (!edgeErr && edgeData?.reply) {
        rawReply = edgeData.reply;
      }
    }
  } catch {
    return null;
  }

  if (!rawReply) return null;

  const parsed = extractJsonObject(rawReply);
  if (!parsed || !parsed.mission || !Array.isArray(parsed.revenueMix) || parsed.revenueMix.length === 0) {
    return null;
  }

  const enriched: CompanyStrategicProfile = {
    ticker,
    mission: String(parsed.mission),
    vision: String(parsed.vision || ''),
    businessSummary: String(parsed.businessSummary || ''),
    participatingMarkets: Array.isArray(parsed.participatingMarkets) ? parsed.participatingMarkets.map(String) : [],
    revenueMix: parsed.revenueMix.slice(0, 5).map((r: any) => ({
      productOrService: String(r.productOrService || 'Segmento Principal'),
      marketOrSector: String(r.marketOrSector || stock.industry || ''),
      revenueSharePct: Number(r.revenueSharePct) || 0,
      competitors: Array.isArray(r.competitors) ? r.competitors.map(String) : [],
      description: String(r.description || ''),
    })),
    competitivePositionSummary: String(parsed.competitivePositionSummary || ''),
    competitiveAdvantages: Array.isArray(parsed.competitiveAdvantages)
      ? parsed.competitiveAdvantages.slice(0, 4).map((a: any) => ({
          title: String(a.title || 'Ventaja Competitiva'),
          moatMechanism: String(a.moatMechanism || ''),
          evidence: String(a.evidence || ''),
        }))
      : [],
    sectorFutureObjectives: Array.isArray(parsed.sectorFutureObjectives)
      ? parsed.sectorFutureObjectives.map(String)
      : [],
    economicAndSocialImpact: String(parsed.economicAndSocialImpact || ''),
    macroFactors: Array.isArray(parsed.macroFactors)
      ? parsed.macroFactors.slice(0, 4).map((m: any) => ({
          factor: String(m.factor || 'Factor Macro'),
          sensitivity: (['Alta', 'Media', 'Favorable', 'Directa'].includes(m.sensitivity) ? m.sensitivity : 'Media') as MacroFactorImpact['sensitivity'],
          explanation: String(m.explanation || ''),
        }))
      : [],
    sectorRisks: String(parsed.sectorRisks || ''),
    sourceType: 'ai_enriched',
  };

  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(
        `${PROFILE_CACHE_PREFIX}${ticker}`,
        JSON.stringify({ timestamp: Date.now(), profile: enriched })
      );
    } catch {
      // noop
    }
  }

  return enriched;
}
