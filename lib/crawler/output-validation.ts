import remarkParse from 'remark-parse';
import { unified } from 'unified';
import { visit } from 'unist-util-visit';

const UNSAFE_MARKDOWN_NODES = new Set(['definition', 'html', 'image', 'imageReference', 'link', 'linkReference']);
const SENSITIVE_TEXT_PATTERNS = [
  /\b(?:https?|ftp):\/\/\S+/iu,
  /\bwww\.[^\s]+/iu,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/u,
  /\b(?:sk|pk)-[A-Za-z0-9_-]{16,}\b/u,
  /\bgh[pousr]_[A-Za-z0-9]{20,}\b/u,
  /\bAIza[A-Za-z0-9_-]{20,}\b/u,
  /\b(?:api[_ -]?key|access[_ -]?token|auth[_ -]?token|secret)\s*[:=]\s*[^\s]{12,}/iu,
];

type MarkdownNode = {
  children?: MarkdownNode[];
  depth?: number;
  type: string;
  value?: string;
};

function markdownTree(value: string) {
  return unified().use(remarkParse).parse(value);
}

function nodeText(node: MarkdownNode): string {
  if (typeof node.value === 'string') return node.value;
  return (node.children || []).map(nodeText).join(' ');
}

export function containsUnsafeMarkdown(value: string) {
  const tree = markdownTree(value);
  let unsafe = false;
  visit(tree, (node) => {
    if (UNSAFE_MARKDOWN_NODES.has(node.type)) unsafe = true;
  });
  return unsafe;
}

export function hasShallowMarkdownHeading(value: string) {
  const tree = markdownTree(value);
  let shallow = false;
  visit(tree, 'heading', (node) => {
    if (node.depth < 3) shallow = true;
  });
  return shallow;
}

export function containsSensitiveOutput(value: string) {
  return SENSITIVE_TEXT_PATTERNS.some((pattern) => pattern.test(value));
}

export function hasInvalidMarkdownLayout(value: string) {
  if (/\n{4,}/u.test(value) || value.split('\n').some((line) => line.length > 700)) return true;
  if (/\b(?:primary|supporting) page\b|\bwebsite_data\b/iu.test(value)) return true;

  const tree = markdownTree(value);
  const topLevel = tree.children as unknown as MarkdownNode[];
  const headings = topLevel.filter((node) => node.type === 'heading');
  if (headings.length < 3 || headings.length > 6 || topLevel[0]?.type !== 'heading') return true;
  if (headings.some((heading) => heading.depth !== 3 || nodeText(heading).trim().length > 100)) return true;

  const headingNames = new Set<string>();
  let sectionHasBody = false;
  let invalid = false;
  topLevel.forEach((node) => {
    if (node.type === 'heading') {
      if (headingNames.size > 0 && !sectionHasBody) invalid = true;
      const name = nodeText(node).trim().toLocaleLowerCase();
      if (headingNames.has(name)) invalid = true;
      headingNames.add(name);
      sectionHasBody = false;
      return;
    }
    sectionHasBody = true;
  });
  if (!sectionHasBody) invalid = true;

  const paragraphs = new Set<string>();
  visit(tree, (node) => {
    const markdownNode = node as MarkdownNode;
    if (['blockquote', 'code', 'thematicBreak'].includes(markdownNode.type)) invalid = true;
    if (markdownNode.type === 'list' && (markdownNode.children?.length || 0) > 7) invalid = true;
    if (markdownNode.type !== 'paragraph') return;
    const paragraph = nodeText(markdownNode).replace(/\s+/gu, ' ').trim();
    if (paragraph.length > 700) invalid = true;
    const normalized = paragraph.toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ');
    if (normalized.length >= 60 && paragraphs.has(normalized)) invalid = true;
    if (normalized.length >= 60) paragraphs.add(normalized);
  });
  return invalid;
}
