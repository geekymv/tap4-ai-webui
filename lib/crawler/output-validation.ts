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

function markdownTree(value: string) {
  return unified().use(remarkParse).parse(value);
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
