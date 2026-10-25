import type { Metadata } from 'next';

import { getIntentLocale } from '@/lib/intent-pages';
import { languageAlternates } from '@/lib/seo';

const copy = {
  en: [
    'How the GetAITools catalog works',
    'Catalog entries are based on provider websites and publicly available page content. We summarize that material to help people discover tools.',
    'A catalog date records when an entry was added or refreshed; it is not a promise that every claim was independently verified on that date.',
    'Providers can change features, pricing, privacy terms, and availability. Always confirm decision-critical information on the provider website. Sponsored or affiliate destinations are marked with appropriate link attributes.',
  ],
  jp: [
    'GetAIToolsカタログの仕組み',
    'カタログは提供元サイトと公開ページの情報に基づき、ツール発見を支援するために要約しています。',
    'カタログ日付は登録または更新時点を示し、すべての記述を独自検証したことを意味しません。',
    '機能、料金、プライバシー規約、提供状況は変更されます。重要な情報は提供元で確認してください。',
  ],
  de: [
    'So funktioniert der GetAITools-Katalog',
    'Einträge basieren auf Anbieterwebsites und öffentlich verfügbaren Inhalten, die zur besseren Auffindbarkeit zusammengefasst werden.',
    'Das Katalogdatum zeigt Aufnahme oder Aktualisierung, aber keine unabhängige Prüfung aller Angaben.',
    'Funktionen, Preise, Datenschutz und Verfügbarkeit können sich ändern. Entscheidungsrelevante Angaben immer beim Anbieter prüfen.',
  ],
  es: [
    'Cómo funciona el catálogo GetAITools',
    'Las entradas se basan en sitios de proveedores y contenido público, resumido para facilitar el descubrimiento.',
    'La fecha indica cuándo se añadió o actualizó una entrada; no implica verificación independiente de cada afirmación.',
    'Funciones, precios, privacidad y disponibilidad pueden cambiar. Confirma la información importante con el proveedor.',
  ],
  fr: [
    'Fonctionnement du catalogue GetAITools',
    'Les fiches reposent sur les sites des fournisseurs et des contenus publics, résumés pour faciliter la découverte.',
    'La date indique l’ajout ou l’actualisation, sans garantir une vérification indépendante de chaque affirmation.',
    'Fonctions, tarifs, confidentialité et disponibilité peuvent changer. Confirmez les informations importantes auprès du fournisseur.',
  ],
  pt: [
    'Como funciona o catálogo GetAITools',
    'As entradas baseiam-se nos sites dos fornecedores e em conteúdo público, resumido para facilitar a descoberta.',
    'A data indica inclusão ou atualização, não a verificação independente de todas as alegações.',
    'Recursos, preços, privacidade e disponibilidade podem mudar. Confirme informações importantes com o fornecedor.',
  ],
  ru: [
    'Как работает каталог GetAITools',
    'Записи основаны на сайтах поставщиков и открытых материалах, которые мы кратко излагаем для поиска инструментов.',
    'Дата показывает добавление или обновление записи, но не означает независимую проверку всех утверждений.',
    'Функции, цены, условия конфиденциальности и доступность меняются. Важные данные проверяйте у поставщика.',
  ],
  cn: [
    'GetAITools 目录如何运作',
    '目录条目基于服务商网站及公开页面内容，我们对这些资料进行摘要，帮助用户发现工具。',
    '目录日期表示条目的收录或更新时间，不代表当日已独立验证其中每项声明。',
    '服务商可能调整功能、价格、隐私条款和可用性。作出选择前，请在服务商网站确认关键信息。',
  ],
  tw: [
    'GetAITools 目錄如何運作',
    '目錄條目根據服務商網站及公開頁面內容，我們摘要這些資料以協助使用者發現工具。',
    '目錄日期表示條目的收錄或更新時間，不代表當日已獨立驗證每項聲明。',
    '服務商可能調整功能、價格、隱私條款和可用性。選擇前，請在服務商網站確認關鍵資訊。',
  ],
} as const;

export async function generateMetadata({ params }: { params: { locale: string } }): Promise<Metadata> {
  const text = copy[getIntentLocale(params.locale)];
  return {
    title: text[0],
    description: text[1],
    alternates: languageAlternates(params.locale, '/editorial-methodology'),
  };
}

export default function Page({ params }: { params: { locale: string } }) {
  const text = copy[getIntentLocale(params.locale)];
  return (
    <main className='mx-auto w-full max-w-3xl px-5 py-12'>
      <h1 className='text-3xl font-bold lg:text-5xl'>{text[0]}</h1>
      <div className='mt-8 space-y-5 text-base leading-8 text-white/75'>
        {text.slice(1).map((paragraph) => (
          <p key={paragraph}>{paragraph}</p>
        ))}
      </div>
    </main>
  );
}
