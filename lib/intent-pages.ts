export type IntentLocale = 'en' | 'jp' | 'de' | 'es' | 'fr' | 'pt' | 'ru' | 'cn' | 'tw';

type IntentPage = {
  slug: string;
  category: string;
  labels: Record<IntentLocale, string>;
};

const labels = (
  en: string,
  jp: string,
  de: string,
  es: string,
  fr: string,
  pt: string,
  ru: string,
  cn: string,
  tw: string,
): IntentPage['labels'] => ({ en, jp, de, es, fr, pt, ru, cn, tw });

export const intentPages: IntentPage[] = [
  {
    slug: 'ai-writing-assistants',
    category: 'text-writing',
    labels: labels(
      'AI writing assistants',
      'AI文章作成アシスタント',
      'KI-Schreibassistenten',
      'Asistentes de escritura con IA',
      'Assistants d’écriture IA',
      'Assistentes de escrita com IA',
      'ИИ-помощники для письма',
      'AI 写作助手',
      'AI 寫作助手',
    ),
  },
  {
    slug: 'ai-copywriting-tools',
    category: 'text-writing',
    labels: labels(
      'AI copywriting tools',
      'AIコピーライティングツール',
      'KI-Copywriting-Tools',
      'Herramientas de copywriting con IA',
      'Outils de copywriting IA',
      'Ferramentas de copywriting com IA',
      'ИИ-инструменты для копирайтинга',
      'AI 文案工具',
      'AI 文案工具',
    ),
  },
  {
    slug: 'ai-image-generators',
    category: 'image',
    labels: labels(
      'AI image generators',
      'AI画像生成ツール',
      'KI-Bildgeneratoren',
      'Generadores de imágenes con IA',
      'Générateurs d’images IA',
      'Geradores de imagens com IA',
      'ИИ-генераторы изображений',
      'AI 图像生成器',
      'AI 圖像生成器',
    ),
  },
  {
    slug: 'ai-photo-editors',
    category: 'image',
    labels: labels(
      'AI photo editors',
      'AI写真編集ツール',
      'KI-Fotoeditoren',
      'Editores de fotos con IA',
      'Éditeurs photo IA',
      'Editores de fotos com IA',
      'ИИ-фоторедакторы',
      'AI 照片编辑器',
      'AI 照片編輯器',
    ),
  },
  {
    slug: 'ai-video-generators',
    category: 'video',
    labels: labels(
      'AI video generators',
      'AI動画生成ツール',
      'KI-Videogeneratoren',
      'Generadores de vídeo con IA',
      'Générateurs vidéo IA',
      'Geradores de vídeo com IA',
      'ИИ-генераторы видео',
      'AI 视频生成器',
      'AI 影片生成器',
    ),
  },
  {
    slug: 'ai-video-editors',
    category: 'video',
    labels: labels(
      'AI video editors',
      'AI動画編集ツール',
      'KI-Videoeditoren',
      'Editores de vídeo con IA',
      'Éditeurs vidéo IA',
      'Editores de vídeo com IA',
      'ИИ-видеоредакторы',
      'AI 视频编辑器',
      'AI 影片編輯器',
    ),
  },
  {
    slug: 'ai-coding-assistants',
    category: 'code-it',
    labels: labels(
      'AI coding assistants',
      'AIコーディング支援',
      'KI-Programmierassistenten',
      'Asistentes de programación con IA',
      'Assistants de programmation IA',
      'Assistentes de programação com IA',
      'ИИ-помощники программиста',
      'AI 编程助手',
      'AI 程式設計助手',
    ),
  },
  {
    slug: 'ai-website-builders',
    category: 'code-it',
    labels: labels(
      'AI website builders',
      'AIウェブサイト作成ツール',
      'KI-Website-Baukästen',
      'Creadores de sitios web con IA',
      'Créateurs de sites web IA',
      'Criadores de sites com IA',
      'ИИ-конструкторы сайтов',
      'AI 网站生成器',
      'AI 網站生成器',
    ),
  },
  {
    slug: 'ai-voice-generators',
    category: 'voice',
    labels: labels(
      'AI voice generators',
      'AI音声生成ツール',
      'KI-Sprachgeneratoren',
      'Generadores de voz con IA',
      'Générateurs de voix IA',
      'Geradores de voz com IA',
      'ИИ-генераторы голоса',
      'AI 语音生成器',
      'AI 語音生成器',
    ),
  },
  {
    slug: 'ai-transcription-tools',
    category: 'voice',
    labels: labels(
      'AI transcription tools',
      'AI文字起こしツール',
      'KI-Transkriptionstools',
      'Herramientas de transcripción con IA',
      'Outils de transcription IA',
      'Ferramentas de transcrição com IA',
      'ИИ-инструменты транскрибации',
      'AI 转录工具',
      'AI 轉錄工具',
    ),
  },
  {
    slug: 'ai-marketing-tools',
    category: 'marketing',
    labels: labels(
      'AI marketing tools',
      'AIマーケティングツール',
      'KI-Marketing-Tools',
      'Herramientas de marketing con IA',
      'Outils marketing IA',
      'Ferramentas de marketing com IA',
      'ИИ-инструменты для маркетинга',
      'AI 营销工具',
      'AI 行銷工具',
    ),
  },
  {
    slug: 'ai-seo-tools',
    category: 'marketing',
    labels: labels(
      'AI SEO tools',
      'AI SEOツール',
      'KI-SEO-Tools',
      'Herramientas SEO con IA',
      'Outils SEO IA',
      'Ferramentas de SEO com IA',
      'ИИ-инструменты SEO',
      'AI SEO 工具',
      'AI SEO 工具',
    ),
  },
  {
    slug: 'ai-business-tools',
    category: 'business',
    labels: labels(
      'AI business tools',
      'AIビジネスツール',
      'KI-Business-Tools',
      'Herramientas empresariales con IA',
      'Outils professionnels IA',
      'Ferramentas empresariais com IA',
      'ИИ-инструменты для бизнеса',
      'AI 商业工具',
      'AI 商業工具',
    ),
  },
  {
    slug: 'ai-presentation-makers',
    category: 'business',
    labels: labels(
      'AI presentation makers',
      'AIプレゼン作成ツール',
      'KI-Präsentationstools',
      'Creadores de presentaciones con IA',
      'Créateurs de présentations IA',
      'Criadores de apresentações com IA',
      'ИИ-сервисы для презентаций',
      'AI 演示文稿工具',
      'AI 簡報工具',
    ),
  },
  {
    slug: 'ai-chatbots',
    category: 'chatbot',
    labels: labels(
      'AI chatbots',
      'AIチャットボット',
      'KI-Chatbots',
      'Chatbots con IA',
      'Chatbots IA',
      'Chatbots com IA',
      'ИИ-чат-боты',
      'AI 聊天机器人',
      'AI 聊天機器人',
    ),
  },
  {
    slug: 'ai-detectors',
    category: 'ai-detector',
    labels: labels(
      'AI content detectors',
      'AIコンテンツ検出ツール',
      'KI-Inhaltsdetektoren',
      'Detectores de contenido con IA',
      'Détecteurs de contenu IA',
      'Detectores de conteúdo de IA',
      'Детекторы ИИ-контента',
      'AI 内容检测器',
      'AI 內容檢測器',
    ),
  },
  {
    slug: 'ai-design-tools',
    category: 'design-art',
    labels: labels(
      'AI design tools',
      'AIデザインツール',
      'KI-Design-Tools',
      'Herramientas de diseño con IA',
      'Outils de design IA',
      'Ferramentas de design com IA',
      'ИИ-инструменты для дизайна',
      'AI 设计工具',
      'AI 設計工具',
    ),
  },
  {
    slug: 'ai-study-tools',
    category: 'education',
    labels: labels(
      'AI study tools',
      'AI学習ツール',
      'KI-Lerntools',
      'Herramientas de estudio con IA',
      'Outils d’apprentissage IA',
      'Ferramentas de estudo com IA',
      'ИИ-инструменты для учебы',
      'AI 学习工具',
      'AI 學習工具',
    ),
  },
  {
    slug: 'ai-productivity-tools',
    category: 'productivity',
    labels: labels(
      'AI productivity tools',
      'AI生産性向上ツール',
      'KI-Produktivitätstools',
      'Herramientas de productividad con IA',
      'Outils de productivité IA',
      'Ferramentas de produtividade com IA',
      'ИИ-инструменты продуктивности',
      'AI 效率工具',
      'AI 生產力工具',
    ),
  },
  {
    slug: 'ai-prompt-tools',
    category: 'prompt',
    labels: labels(
      'AI prompt tools',
      'AIプロンプトツール',
      'KI-Prompt-Tools',
      'Herramientas de prompts de IA',
      'Outils de prompts IA',
      'Ferramentas de prompts de IA',
      'ИИ-инструменты для промптов',
      'AI 提示词工具',
      'AI 提示詞工具',
    ),
  },
];

type IntentCopy = {
  title: string;
  description: string;
  intro: string;
  catalogNote: string;
  faqTitle: string;
  faq: Array<[string, string]>;
  empty: string;
};

export const intentCopy: Record<IntentLocale, IntentCopy> = {
  en: {
    title: 'Best {intent} to explore',
    description:
      'Explore {intent} in the GetAITools catalog. Compare published descriptions and visit providers for current features and pricing.',
    intro:
      'Browse tools cataloged for this use case. The list uses existing catalog data and does not claim an independent ranking or verification.',
    catalogNote: 'Check each provider for current features, terms, and pricing before choosing a tool.',
    faqTitle: 'How to choose',
    faq: [
      [
        'How are tools selected?',
        'Tools are shown from the related GetAITools category and ordered by catalog date. This is not a paid ranking.',
      ],
      ['Is pricing verified?', 'No. Pricing changes frequently, so confirm current plans on the provider website.'],
      [
        'What should I compare?',
        'Compare fit for your task, data handling, output quality, usage limits, and total cost.',
      ],
    ],
    empty: 'No matching catalog entries are available yet.',
  },
  jp: {
    title: 'おすすめの{intent}',
    description:
      'GetAIToolsカタログで{intent}を探し、公開情報を比較できます。最新の機能と料金は提供元で確認してください。',
    intro: 'この用途に関連する既存のカタログ情報を掲載しています。独自の順位付けや検証済みという主張は行いません。',
    catalogNote: '選定前に、最新の機能、利用規約、料金を各提供元で確認してください。',
    faqTitle: '選び方',
    faq: [
      [
        'ツールはどのように選ばれますか？',
        '関連カテゴリのツールをカタログ登録日順に表示します。有料ランキングではありません。',
      ],
      ['料金は確認済みですか？', 'いいえ。料金は変わるため、提供元サイトで最新プランをご確認ください。'],
      ['何を比較すべきですか？', '用途との適合性、データ処理、出力品質、利用上限、総費用を比較してください。'],
    ],
    empty: '該当するツールはまだありません。',
  },
  de: {
    title: 'Die besten {intent} zum Entdecken',
    description:
      'Entdecken Sie {intent} im GetAITools-Katalog. Aktuelle Funktionen und Preise bitte beim Anbieter prüfen.',
    intro:
      'Diese Auswahl basiert auf vorhandenen Katalogdaten. Sie ist weder ein unabhängiges Ranking noch eine Verifizierung.',
    catalogNote: 'Prüfen Sie vor der Auswahl Funktionen, Bedingungen und Preise direkt beim Anbieter.',
    faqTitle: 'Auswahlhilfe',
    faq: [
      [
        'Wie werden Tools ausgewählt?',
        'Tools stammen aus der passenden Kategorie und sind nach Katalogdatum sortiert. Es ist kein bezahltes Ranking.',
      ],
      ['Sind Preise verifiziert?', 'Nein. Preise ändern sich; prüfen Sie aktuelle Tarife beim Anbieter.'],
      [
        'Was sollte ich vergleichen?',
        'Vergleichen Sie Eignung, Datenverarbeitung, Ausgabequalität, Limits und Gesamtkosten.',
      ],
    ],
    empty: 'Noch keine passenden Katalogeinträge verfügbar.',
  },
  es: {
    title: 'Mejores {intent} para explorar',
    description:
      'Explora {intent} en el catálogo GetAITools. Consulta funciones y precios actuales con cada proveedor.',
    intro:
      'Esta selección usa datos existentes del catálogo y no constituye una clasificación independiente ni una verificación.',
    catalogNote: 'Confirma funciones, condiciones y precios actuales con el proveedor antes de elegir.',
    faqTitle: 'Cómo elegir',
    faq: [
      [
        '¿Cómo se seleccionan?',
        'Se muestran herramientas de la categoría relacionada por fecha de catálogo. No es una clasificación pagada.',
      ],
      [
        '¿Se verifican los precios?',
        'No. Los precios cambian; consulta los planes actuales en el sitio del proveedor.',
      ],
      ['¿Qué debo comparar?', 'Compara adecuación, tratamiento de datos, calidad, límites y coste total.'],
    ],
    empty: 'Aún no hay entradas coincidentes.',
  },
  fr: {
    title: 'Meilleurs {intent} à découvrir',
    description:
      'Explorez les {intent} du catalogue GetAITools. Vérifiez les fonctions et tarifs actuels auprès du fournisseur.',
    intro:
      'Cette sélection repose sur les données existantes du catalogue et ne constitue ni un classement indépendant ni une vérification.',
    catalogNote: 'Vérifiez les fonctions, conditions et tarifs actuels auprès du fournisseur avant de choisir.',
    faqTitle: 'Comment choisir',
    faq: [
      [
        'Comment les outils sont-ils sélectionnés ?',
        'Ils proviennent de la catégorie associée et sont triés par date de catalogue. Ce classement n’est pas payant.',
      ],
      ['Les tarifs sont-ils vérifiés ?', 'Non. Les tarifs changent ; consultez le site du fournisseur.'],
      [
        'Que faut-il comparer ?',
        'Comparez l’adéquation, le traitement des données, la qualité, les limites et le coût total.',
      ],
    ],
    empty: 'Aucune entrée correspondante pour le moment.',
  },
  pt: {
    title: 'Melhores {intent} para explorar',
    description: 'Explore {intent} no catálogo GetAITools. Confirme recursos e preços atuais com cada fornecedor.',
    intro: 'Esta seleção usa dados existentes do catálogo e não representa classificação independente nem verificação.',
    catalogNote: 'Confirme recursos, termos e preços atuais com o fornecedor antes de escolher.',
    faqTitle: 'Como escolher',
    faq: [
      [
        'Como as ferramentas são selecionadas?',
        'São exibidas ferramentas da categoria relacionada por data de catálogo. Não é um ranking pago.',
      ],
      ['Os preços são verificados?', 'Não. Os preços mudam; consulte os planos atuais no site do fornecedor.'],
      ['O que devo comparar?', 'Compare adequação, tratamento de dados, qualidade, limites e custo total.'],
    ],
    empty: 'Ainda não há itens correspondentes.',
  },
  ru: {
    title: 'Лучшие {intent}',
    description: 'Изучите {intent} в каталоге GetAITools. Актуальные функции и цены уточняйте у поставщика.',
    intro:
      'Подборка основана на существующих данных каталога и не является независимым рейтингом или подтверждением качества.',
    catalogNote: 'Перед выбором проверьте функции, условия и цены на сайте поставщика.',
    faqTitle: 'Как выбрать',
    faq: [
      [
        'Как выбираются инструменты?',
        'Показаны инструменты связанной категории по дате добавления. Это не платный рейтинг.',
      ],
      ['Цены проверены?', 'Нет. Цены меняются — уточняйте актуальные тарифы у поставщика.'],
      ['Что сравнивать?', 'Сравните соответствие задаче, обработку данных, качество, лимиты и общую стоимость.'],
    ],
    empty: 'Подходящих записей пока нет.',
  },
  cn: {
    title: '值得探索的{intent}',
    description: '在 GetAITools 目录中探索{intent}。请前往服务商网站确认当前功能和价格。',
    intro: '本页基于现有目录数据展示相关工具，不构成独立排名，也不声称工具已经过验证。',
    catalogNote: '选择前，请在服务商网站确认当前功能、条款和价格。',
    faqTitle: '如何选择',
    faq: [
      ['工具如何入选？', '页面展示相关分类中的工具，并按收录时间排序，不是付费排名。'],
      ['价格经过验证吗？', '没有。价格可能变化，请以服务商网站的最新方案为准。'],
      ['应该比较什么？', '建议比较任务匹配度、数据处理方式、输出质量、使用限制和总成本。'],
    ],
    empty: '目录中暂时没有匹配的工具。',
  },
  tw: {
    title: '值得探索的{intent}',
    description: '在 GetAITools 目錄中探索{intent}。請前往服務商網站確認目前功能和價格。',
    intro: '本頁根據現有目錄資料展示相關工具，不構成獨立排名，也不聲稱工具已經過驗證。',
    catalogNote: '選擇前，請在服務商網站確認目前功能、條款和價格。',
    faqTitle: '如何選擇',
    faq: [
      ['工具如何入選？', '頁面展示相關分類中的工具，並按收錄時間排序，不是付費排名。'],
      ['價格經過驗證嗎？', '沒有。價格可能變更，請以服務商網站的最新方案為準。'],
      ['應該比較什麼？', '建議比較任務匹配度、資料處理方式、輸出品質、使用限制和總成本。'],
    ],
    empty: '目錄中暫時沒有符合的工具。',
  },
};

export function getIntentPage(slug: string) {
  return intentPages.find((page) => page.slug === slug);
}

export function getIntentLocale(locale: string): IntentLocale {
  return locale in intentCopy ? (locale as IntentLocale) : 'en';
}

export function interpolate(template: string, intent: string) {
  return template.replace('{intent}', intent);
}
