const fs = require('fs');
const path = require('path');

/**
 * Parses simple YAML files/strings into JavaScript objects.
 * Supports basic key-value hierarchies, lists (- value), booleans, numbers, and strings.
 */
function parseYaml(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const root = {};
  const contextStack = [{ indent: -1, obj: root }];

  for (let line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    const indent = line.length - line.trimStart().length;

    // Handle list item
    if (trimmed.startsWith('-')) {
      const valStr = trimmed.slice(1).trim();
      const parent = findParent(contextStack, indent);
      if (parent) {
        if (!Array.isArray(parent.obj)) {
          // If parent object is a map, we need to convert the key to an array or list context
          // However, in standard YAML mapping lists, a key points to a list:
          // key:
          //   - val1
          // Here parent.obj will be the list holder if we handle empty key.
        } else {
          parent.obj.push(parseScalar(valStr));
        }
      }
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) {
      continue;
    }

    const key = trimmed.slice(0, colonIdx).trim();
    const valStr = trimmed.slice(colonIdx + 1).trim();

    const parent = findParent(contextStack, indent);
    if (!parent) continue;

    if (valStr === '') {
      // Determine if next non-empty line starts with '-' (meaning it's an array) or has greater indentation
      // We create a container (object or array) and push it to stack.
      // We will default to object, but if list items follow, we will turn it into array.
      const containerObj = {};
      parent.obj[key] = containerObj;
      contextStack.push({ indent, obj: containerObj, key, parentObj: parent.obj });
    } else {
      parent.obj[key] = parseScalar(valStr);
    }
  }

  // Post-process structures: if an object keys are actually list items, restructure them.
  restructureLists(root);
  return root;
}

function findParent(stack, indent) {
  while (stack.length > 0 && stack[stack.length - 1].indent >= indent) {
    stack.pop();
  }
  return stack[stack.length - 1] || null;
}

function parseScalar(valStr) {
  if (valStr === 'true') return true;
  if (valStr === 'false') return false;
  if (valStr === 'null') return null;
  if (!isNaN(valStr) && valStr !== '') return Number(valStr);
  // Strip quotes if present
  if ((valStr.startsWith('"') && valStr.endsWith('"')) || (valStr.startsWith("'") && valStr.endsWith("'"))) {
    return valStr.slice(1, -1);
  }
  return valStr;
}

/**
 * Traverses the object and converts nodes that were meant to be arrays.
 * e.g., if a key has list items under it, YAML lines parser adds them.
 * In YAML:
 * key:
 *   - val1
 * Lines parsed: key: empty, followed by list items.
 * If we detect list items, we should attach them to that key.
 */
function restructureLists(obj) {
  if (typeof obj !== 'object' || obj === null) return;

  for (let key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'object' && val !== null) {
      restructureLists(val);

      // Check if this object represents a list container.
      // If we parser empty mapping keys, we can look ahead.
      // Let's implement list collection directly in the line loop for simplicity,
      // but if the object is empty, check if we need to resolve it.
    }
  }
}

// Improved YAML parser that handles arrays more natively by looking at lines statefully
function parseYamlStateful(yamlText) {
  const lines = yamlText.split(/\r?\n/);
  const root = {};
  
  // Track stack of [indent, reference]
  // We can track the current path of keys
  const path = []; 
  
  function getRef(p) {
    let curr = root;
    for (let segment of p) {
      curr = curr[segment];
    }
    return curr;
  }

  function setRef(p, value) {
    let curr = root;
    for (let i = 0; i < p.length - 1; i++) {
      curr = curr[p[i]];
    }
    curr[p[p.length - 1]] = value;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (trimmed === '' || trimmed.startsWith('#')) continue;

    const indent = line.length - line.trimStart().length;

    // Adjust path according to current indentation
    while (path.length > 0 && path[path.length - 1].indent >= indent) {
      path.pop();
    }

    if (trimmed.startsWith('-')) {
      const valStr = trimmed.slice(1).trim();
      const parentPath = path.map(x => x.key);
      const parentVal = getRef(parentPath);
      
      // If parent is not an array, convert it to an array
      // In yaml, the parent would have been parsed as empty value map.
      const lastSegment = path[path.length - 1];
      if (lastSegment) {
        const parentOfParentPath = path.slice(0, -1).map(x => x.key);
        const parentKey = lastSegment.key;
        const parentContainer = parentOfParentPath.length === 0 ? root : getRef(parentOfParentPath);
        
        if (!Array.isArray(parentContainer[parentKey]) || parentContainer[parentKey] === null) {
          parentContainer[parentKey] = [];
        }
        parentContainer[parentKey].push(parseScalar(valStr));
      }
      continue;
    }

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    const valStr = trimmed.slice(colonIdx + 1).trim();

    const parentPath = path.map(x => x.key);
    const parent = parentPath.length === 0 ? root : getRef(parentPath);

    if (valStr === '') {
      parent[key] = {};
      path.push({ indent, key });
    } else {
      parent[key] = parseScalar(valStr);
    }
  }

  return root;
}

/**
 * Extracts YAML codeblocks or Frontmatter from a Markdown file and parses it.
 */
function parseMarkdownPolicy(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    
    // Pattern 1: yaml codeblock (```yaml ... ```)
    const codeBlockMatch = content.match(/```yaml([\s\S]*?)```/);
    if (codeBlockMatch) {
      return parseYamlStateful(codeBlockMatch[1]);
    }

    // Pattern 2: frontmatter (--- ... ---)
    const frontmatterMatch = content.match(/^---([\s\S]*?)---/);
    if (frontmatterMatch) {
      return parseYamlStateful(frontmatterMatch[1]);
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to parse policy file ${filePath}: ${error.message}`);
  }
}

module.exports = {
  parseYaml: parseYamlStateful,
  parseMarkdownPolicy
};
