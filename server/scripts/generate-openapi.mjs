#!/usr/bin/env node
/*
 * generate-openapi.mjs — Shoreline Care OS OpenAPI generator (Wave C, task C07).
 *
 * Statically parses the Express route surface — server/src/index.ts (mounts) and
 * server/src/routes/*.ts (handlers) — and emits server/src/docs/openapi.json.
 *
 * Nothing here executes route code or touches the database; it is a source
 * reader. Auth metadata (requireAuth / requireRole / requireTier / the custom
 * webhook-signature and strict-equality role gates) is read from the actual
 * middleware chains — never guessed.
 *
 * Usage:
 *   node scripts/generate-openapi.mjs            # regenerate server/src/docs/openapi.json
 *   node scripts/generate-openapi.mjs --check    # exit 1 when the checked-in spec drifts
 *
 * npm scripts (server/package.json):
 *   docs:generate  ->  node scripts/generate-openapi.mjs
 *   docs:check     ->  node scripts/generate-openapi.mjs --check
 *
 * Determinism: output is fully derived from source text; no timestamps, no
 * randomness. The --check mode is suitable for CI drift detection.
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SERVER_DIR = path.resolve(__dirname, '..')
const ROUTES_DIR = path.join(SERVER_DIR, 'src', 'routes')
const INDEX_TS = path.join(SERVER_DIR, 'src', 'index.ts')
const OUT_PATH = path.join(SERVER_DIR, 'src', 'docs', 'openapi.json')
const CHECK_MODE = process.argv.includes('--check')

const warnings = []
function warn(msg) { warnings.push(msg) }

/* ------------------------------------------------------------------ */
/* Low-level source scanning (strings/comments/template-aware)         */
/* ------------------------------------------------------------------ */

function skipQuoted(src, i, quote) {
  // i points at opening quote; returns index just past closing quote
  let j = i + 1
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') { j += 2; continue }
    if (c === quote) return j + 1
    j++
  }
  return j
}

function skipTemplate(src, i) {
  // i points at opening backtick; handles ${ ... } nesting
  let j = i + 1
  while (j < src.length) {
    const c = src[j]
    if (c === '\\') { j += 2; continue }
    if (c === '`') return j + 1
    if (c === '$' && src[j + 1] === '{') {
      const end = findBracketEnd(src, j + 1) // index of matching }
      j = end === -1 ? src.length : end + 1
      continue
    }
    j++
  }
  return j
}

function findBracketEnd(src, openIdx) {
  // openIdx points at one of ( [ { — returns index of the matching closer
  const match = { '(': ')', '[': ']', '{': '}' }
  const stack = [match[src[openIdx]]]
  let i = openIdx + 1
  while (i < src.length && stack.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') {
      const e = src.indexOf('\n', i)
      i = e === -1 ? src.length : e + 1
      continue
    }
    if (c === '/' && src[i + 1] === '*') {
      const e = src.indexOf('*/', i + 2)
      i = e === -1 ? src.length : e + 2
      continue
    }
    if (c === '"' || c === "'") { i = skipQuoted(src, i, c); continue }
    if (c === '`') { i = skipTemplate(src, i); continue }
    if (c === '(' || c === '[' || c === '{') stack.push(match[c])
    else if (c === ')' || c === ']' || c === '}') {
      const want = stack.pop()
      if (c !== want) return -1 // unbalanced
    }
    i++
  }
  return stack.length ? -1 : i - 1
}

/** Split text on top-level commas (depth-0), comment/string/template aware. */
function splitTopLevel(text) {
  const parts = []
  let depth = 0
  let cur = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '/') {
      const e = text.indexOf('\n', i)
      const s = e === -1 ? text.length : e
      cur += text.slice(i, s)
      i = s
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2)
      const s = e === -1 ? text.length : e + 2
      cur += text.slice(i, s)
      i = s
      continue
    }
    if (c === '"' || c === "'") { const e = skipQuoted(text, i, c); cur += text.slice(i, e); i = e; continue }
    if (c === '`') { const e = skipTemplate(text, i); cur += text.slice(i, e); i = e; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    if (c === ',' && depth === 0) { parts.push(cur); cur = ''; i++; continue }
    cur += c
    i++
  }
  parts.push(cur)
  return parts
}

/** Split a zod-style call chain on top-level dots: "z.string().optional()" -> [...] */
function splitChain(expr) {
  const parts = []
  let depth = 0
  let cur = ''
  let i = 0
  while (i < expr.length) {
    const c = expr[i]
    if (c === '"' || c === "'") { const e = skipQuoted(expr, i, c); cur += expr.slice(i, e); i = e; continue }
    if (c === '`') { const e = skipTemplate(expr, i); cur += expr.slice(i, e); i = e; continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    if (c === '.' && depth === 0) { parts.push(cur); cur = ''; i++; continue }
    cur += c
    i++
  }
  parts.push(cur)
  return parts.map((p) => p.trim()).filter((p) => p.length > 0)
}

/** Return the raw text inside the outermost parens of a call token like "array(z.string())". */
function callInner(token) {
  const open = token.indexOf('(')
  if (open === -1) return null
  const end = findBracketEnd(token, open)
  if (end === -1) return null
  return token.slice(open + 1, end)
}

function unquote(s) {
  const t = s.trim()
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) {
    return t.slice(1, -1).replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\')
  }
  return t
}

function parseLiteral(s) {
  const t = s.trim()
  if (t === 'true') return true
  if (t === 'false') return false
  if (t === 'null' || t === 'undefined') return null
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t)
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return unquote(t)
  return undefined // not a simple literal
}

/** Strip // and block comments from source text (string-aware). */
function stripComments(text) {
  let out = ''
  let i = 0
  while (i < text.length) {
    const c = text[i]
    if (c === '/' && text[i + 1] === '/') {
      const e = text.indexOf('\n', i)
      i = e === -1 ? text.length : e
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      const e = text.indexOf('*/', i + 2)
      i = e === -1 ? text.length : e + 2
      continue
    }
    if (c === '"' || c === "'") { const e = skipQuoted(text, i, c); out += text.slice(i, e); i = e; continue }
    if (c === '`') { const e = skipTemplate(text, i); out += text.slice(i, e); i = e; continue }
    out += c
    i++
  }
  return out
}

/* ------------------------------------------------------------------ */
/* zod -> JSON Schema conversion                                       */
/* ------------------------------------------------------------------ */

// Filled in pass 1: schema name -> def. Key `${file}::${name}`.
// def = { name, file, kind: 'object'|'general'|'derived'|'alias',
//         inner?, extraFields?, expr?, base?, partial?, extendInner? }
const schemaDefs = new Map()
const schemaNameOwners = new Map() // name -> Set<file>
// const string arrays usable as z.enum(...) args: key `${file}::${name}` -> string[]
const constArrays = new Map()

function zodFieldTypeOf(expr, ctx) { return zodToSchema(expr, ctx).node }

function zodToSchema(expr, ctx) {
  // ctx: { file } — used to resolve file-local const arrays in z.enum(NAME).
  // returns { node, optional, nullable, description, defaultVal }
  const tokens = splitChain(expr)
  if (!tokens.length) return { node: {}, optional: false, nullable: false }
  const base = tokens[0]
  let rest = tokens.slice(1)
  let node = null
  let optional = false
  let nullable = false
  let description = null
  let defaultVal
  let hasDefault = false

  const applyStringFormat = (tok) => {
    const m = tok.match(/^([A-Za-z_$][\w$]*)\s*\(/)
    const name = m ? m[1] : tok
    return { uuid: 'uuid', email: 'email', url: 'uri', datetime: 'date-time', date: 'date', time: 'time', cuid: 'cuid' }[name] || null
  }

  if (base === 'z' || base === 'zod') {
    const t1 = (rest.shift() || '').trim()
    const m = t1.match(/^([A-Za-z_$][\w$]*)\s*\(/)
    let kind = m ? m[1] : t1
    let inner = m ? callInner(t1) : null

    if (kind === 'coerce') {
      const t2 = (rest.shift() || '').trim()
      const m2 = t2.match(/^([A-Za-z_$][\w$]*)\s*\(/)
      const k2 = m2 ? m2[1] : t2
      node = { number: { type: 'number' }, string: { type: 'string' }, boolean: { type: 'boolean' }, date: { type: 'string', format: 'date-time' }, bigint: { type: 'integer' } }[k2] || {}
    } else {
      switch (kind) {
        case 'string': node = { type: 'string' }; break
        case 'number': node = { type: 'number' }; break
        case 'boolean': node = { type: 'boolean' }; break
        case 'bigint': node = { type: 'integer' }; break
        case 'date': node = { type: 'string', format: 'date-time' }; break
        case 'any': case 'unknown': case 'void': case 'never': case 'function':
        case 'custom': case 'promise': case 'map': case 'set':
          node = {}
          break
        case 'preprocess': case 'lazy': case 'instanceof':
          node = {}
          break
        case 'literal': {
          const v = inner != null ? parseLiteral(inner) : undefined
          node = v === undefined ? {} : { const: v }
          break
        }
        case 'enum': {
          const raw = (inner || '').trim()
          let vals
          if (/^[A-Za-z_$][\w$]*$/.test(raw) && ctx && constArrays.has(`${ctx.file}::${raw}`)) {
            vals = constArrays.get(`${ctx.file}::${raw}`)
          } else {
            vals = listOf(inner || '').map((v) => unquote(v.trim()))
          }
          node = { type: 'string', enum: vals }
          break
        }
        case 'nativeEnum':
          node = { type: 'string', 'x-shoreline-zod': `nativeEnum(${(inner || '').trim()})` }
          break
        case 'array': {
          const items = inner != null ? zodFieldTypeOf(inner, ctx) : {}
          node = { type: 'array', items }
          break
        }
        case 'record': {
          const args = inner != null ? splitTopLevel(inner) : []
          const valType = args.length ? zodFieldTypeOf(args[args.length - 1], ctx) : {}
          node = { type: 'object', additionalProperties: valType }
          break
        }
        case 'union': {
          const list = inner != null ? listOf(inner) : []
          node = { anyOf: list.map((e) => zodFieldTypeOf(e, ctx)) }
          break
        }
        case 'discriminatedUnion': {
          const args = inner != null ? splitTopLevel(inner) : []
          const list = args.length ? listOf(args[args.length - 1]) : []
          node = { oneOf: list.map((e) => zodFieldTypeOf(e, ctx)) }
          break
        }
        case 'intersection': {
          const list = inner != null ? listOf(inner) : []
          node = { allOf: list.map((e) => zodFieldTypeOf(e, ctx)) }
          break
        }
        case 'tuple': {
          const list = inner != null ? listOf(inner) : []
          node = { type: 'array', prefixItems: list.map((e) => zodFieldTypeOf(e, ctx)) }
          break
        }
        case 'object': {
          node = objectLiteralToSchema(inner || '', ctx)
          break
        }
        default:
          node = { 'x-shoreline-zod': expr.slice(0, 120) }
          warn(`unmapped zod base "${kind}" in: ${expr.slice(0, 100)}`)
      }
    }
  } else if (/^[A-Za-z_$][\w$]*$/.test(base)) {
    // Reference to another schema (or an unknown identifier)
    const key = ctx ? `${ctx.file}::${base}` : null
    if (key && schemaDefs.has(key)) {
      node = { $ref: `#/components/schemas/${schemaNameFor(ctx.file, base)}` }
    } else {
      node = { 'x-shoreline-zod': base }
      warn(`zod field references unknown identifier "${base}" in: ${expr.slice(0, 100)}`)
    }
  } else {
    node = { 'x-shoreline-zod': expr.slice(0, 120) }
    warn(`unmapped zod expression base in: ${expr.slice(0, 100)}`)
  }

  // Modifier chain
  for (const tok of rest) {
    const mm = tok.match(/^([A-Za-z_$][\w$]*)\s*(\(|$)/)
    const mname = mm ? mm[1] : tok
    const marg = mm && mm[2] === '(' ? callInner(tok) : null
    switch (mname) {
      case 'optional': optional = true; break
      case 'nullable': nullable = true; break
      case 'nullish': optional = true; nullable = true; break
      case 'default': {
        optional = true
        const v = marg != null ? parseLiteral(marg) : undefined
        if (v !== undefined) { defaultVal = v; hasDefault = true }
        break
      }
      case 'catch': optional = true; break
      case 'describe': description = marg != null ? unquote(marg) : null; break
      case 'min': {
        const n = marg != null ? Number(marg) : NaN
        if (!Number.isNaN(n)) {
          if (node.type === 'string') node.minLength = n
          else if (node.type === 'number' || node.type === 'integer') node.minimum = n
          else if (node.type === 'array') node.minItems = n
        }
        break
      }
      case 'max': {
        const n = marg != null ? Number(marg) : NaN
        if (!Number.isNaN(n)) {
          if (node.type === 'string') node.maxLength = n
          else if (node.type === 'number' || node.type === 'integer') node.maximum = n
          else if (node.type === 'array') node.maxItems = n
        }
        break
      }
      case 'length': {
        const n = marg != null ? Number(marg) : NaN
        if (!Number.isNaN(n) && node.type === 'string') { node.minLength = n; node.maxLength = n }
        break
      }
      case 'int': node.type = 'integer'; break
      case 'positive': node.exclusiveMinimum = 0; break
      case 'nonnegative': node.minimum = 0; break
      case 'nonempty':
        if (node.type === 'string') node.minLength = 1
        else if (node.type === 'array') node.minItems = 1
        break
      case 'array': node = { type: 'array', items: node }; break
      case 'uuid': case 'email': case 'url': case 'datetime': case 'date': case 'time': case 'cuid':
        node.format = { uuid: 'uuid', email: 'email', url: 'uri', datetime: 'date-time', date: 'date', time: 'time', cuid: 'cuid' }[mname]
        break
      case 'regex': {
        const firstArg = marg != null ? splitTopLevel(marg)[0].trim() : ''
        const rm = firstArg.match(/^\/(.*)\/[a-z]*$/s)
        if (rm) node.pattern = rm[1]
        break
      }
      case 'refine': case 'superRefine': case 'transform': case 'readonly':
      case 'brand': case 'strict': case 'catchall': case 'passthrough':
      case 'finite': case 'trim': case 'toLowerCase': case 'toUpperCase':
        break // no input-shape effect
      case 'partial': case 'required': case 'pick': case 'omit': case 'extend':
        node['x-shoreline-zod-modifier'] = mname
        break
      default:
        warn(`unmapped zod modifier ".${mname}" in: ${expr.slice(0, 100)}`)
    }
    const fmt = applyStringFormat(tok)
    if (fmt && node.type === 'string' && !node.format) node.format = fmt
  }

  if (description && typeof node === 'object') node.description = description
  if (hasDefault) node.default = defaultVal
  if (nullable) {
    if (typeof node.type === 'string') node.type = [node.type, 'null']
    else if (node.$ref || node.anyOf || node.oneOf || node.const !== undefined || node.enum) {
      const wrapped = { anyOf: [node] }
      // move description/default outward if present
      for (const k of ['description', 'default']) {
        if (node[k] !== undefined) { wrapped[k] = node[k]; delete node[k] }
      }
      wrapped.anyOf.push({ type: 'null' })
      node = wrapped
    }
  }
  return { node, optional, nullable, description }
}

/** Parse "[a, b, c]" (or bare comma list) into item expressions. */
function listOf(inner) {
  const t = inner.trim()
  if (t.startsWith('[')) {
    const end = findBracketEnd(t, 0)
    if (end !== -1) return splitTopLevel(t.slice(1, end)).map((s) => s.trim()).filter(Boolean)
  }
  return splitTopLevel(t).map((s) => s.trim()).filter(Boolean)
}

/** Convert the inside of z.object({ ... }) into a JSON Schema object node. */
function objectLiteralToSchema(inner, ctx) {
  let t = (inner || '').trim()
  // inner is the text between z.object( and ) — i.e. an object literal with braces
  if (t.startsWith('{')) {
    const end = findBracketEnd(t, 0)
    if (end !== -1) t = t.slice(1, end)
  }
  const clean = stripComments(t)
  const fields = splitTopLevel(clean)
  const properties = {}
  const required = []
  for (const f of fields) {
    const ft = f.trim()
    if (!ft) continue
    if (ft.startsWith('...')) { warn(`object spread in zod literal ignored: ${ft.slice(0, 60)}`); continue }
    const m = ft.match(/^((?:"(?:[^"\\]|\\.)*")|(?:'(?:[^'\\]|\\.)*')|(?:[A-Za-z_$][\w$]*))\s*:\s*([\s\S]+)$/)
    if (!m) { warn(`could not parse zod object field: ${ft.slice(0, 80)}`); continue }
    const key = unquote(m[1])
    const parsed = zodToSchema(m[2].trim(), ctx)
    properties[key] = parsed.node
    if (!parsed.optional) required.push(key)
  }
  const schema = { type: 'object', properties }
  if (required.length) schema.required = required
  return schema
}

/* ------------------------------------------------------------------ */
/* Pass 0: mounts from server/src/index.ts                             */
/* ------------------------------------------------------------------ */

function parseMounts(src) {
  const mounts = []
  const re = /app\.use\(/g
  let m
  while ((m = re.exec(src)) !== null) {
    const openIdx = m.index + 'app.use'.length
    const endIdx = findBracketEnd(src, openIdx)
    if (endIdx === -1) { warn('could not parse app.use( at index ' + m.index); continue }
    const inner = src.slice(openIdx + 1, endIdx)
    const args = splitTopLevel(inner).map((a) => a.trim()).filter((a) => a.length)
    if (!args.length) continue
    const baseLit = args[0].match(/^(['"`])((?:[^\\]|\\.)*)\1$/s)
    if (!baseLit || !baseLit[2].startsWith('/api')) continue
    const base = baseLit[2]
    const lastArg = args[args.length - 1]
    const routerMatch = lastArg.match(/^([A-Za-z_$][\w$]*Router)$/)
    if (!routerMatch) continue // e.g. express.raw, limiter, tenantContext
    const routerVar = routerMatch[1]
    const middle = args.slice(1, -1)
    const conditional = /ENABLE_TIMECARD_PLUGIN/.test(src.slice(Math.max(0, m.index - 600), m.index))
      ? 'Mounted only when ENABLE_TIMECARD_PLUGIN !== "false" (see src/index.ts).'
      : null
    mounts.push({ base, routerVar, middle, conditional })
  }
  return mounts
}

/* ------------------------------------------------------------------ */
/* Pass 1: zod schema definitions per route file                        */
/* ------------------------------------------------------------------ */

/** Scan a const initialiser expression starting just after '='. Returns end index (exclusive). */
function scanStatementEnd(src, start) {
  let depth = 0
  let i = start
  while (i < src.length) {
    const c = src[i]
    if (c === '/' && src[i + 1] === '/') { const e = src.indexOf('\n', i); i = e === -1 ? src.length : e; continue }
    if (c === '/' && src[i + 1] === '*') { const e = src.indexOf('*/', i + 2); i = e === -1 ? src.length : e + 2; continue }
    if (c === '"' || c === "'") { i = skipQuoted(src, i, c); continue }
    if (c === '`') { i = skipTemplate(src, i); continue }
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    if (depth === 0 && c === ';') return i
    if (depth === 0 && c === '\n') {
      let j = i + 1
      while (j < src.length && /\s/.test(src[j])) j++
      if (src[j] !== '.') return i // statement ends; chained calls continue on '.'
    }
    i++
  }
  return i
}

function registerSchemaDef(file, name, def) {
  if (!schemaNameOwners.has(name)) schemaNameOwners.set(name, new Set())
  schemaNameOwners.get(name).add(file)
  schemaDefs.set(`${file}::${name}`, { name, file, ...def })
}

function collectSchemaDefs(file, src) {
  // const string arrays (z.enum(NAME) resolution)
  const arrRe = /const\s+([A-Za-z_$][\w$]*)\s*(?::\s*[^=;]+?)?=\s*\[([\s\S]*?)\]\s*(?:as const)?\s*;/g
  let am
  while ((am = arrRe.exec(src)) !== null) {
    const vals = splitTopLevel(am[2]).map((v) => v.trim()).filter((v) => /^(['"]).*\1$/.test(v))
    if (vals.length) constArrays.set(`${file}::${am[1]}`, vals.map(unquote))
  }

  // const NAME = <zod expression>;
  const re = /const\s+([A-Za-z_$][\w$]*)\s*=\s*/g
  let m
  while ((m = re.exec(src)) !== null) {
    const name = m[1]
    let s = m.index + m[0].length
    while (s < src.length && /\s/.test(src[s])) s++
    const rest = src.slice(s, s + 64)
    if (!/^(z[.(]|zod[.(]|[A-Za-z_$][\w$]*\s*\.\s*(partial|extend|omit|pick|required)\s*\()/.test(rest)) continue
    const end = scanStatementEnd(src, s)
    const expr = src.slice(s, end).trim()
    if (!expr) continue
    const t = expr.replace(/\s+/g, ' ')
    let dm
    if (/^z\.object\(/.test(t)) {
      const openIdx = s + expr.indexOf('(')
      const closeIdx = findBracketEnd(src, openIdx)
      if (closeIdx === -1) { warn(`${file}: unbalanced z.object for schema ${name}`); continue }
      const inner = src.slice(openIdx + 1, closeIdx)
      let extraFields = []
      if (/^\s*\.extend\(/.test(src.slice(closeIdx + 1, closeIdx + 12))) {
        const eOpen = src.indexOf('(', closeIdx + 1)
        const eEnd = findBracketEnd(src, eOpen)
        if (eEnd !== -1) extraFields = splitTopLevel(stripComments(src.slice(eOpen + 1, eEnd)))
      }
      registerSchemaDef(file, name, { kind: 'object', inner, extraFields })
    } else if ((dm = t.match(/^([A-Za-z_$][\w$]*)\s*\.\s*partial\s*\(\s*\)\s*\.\s*extend\s*\(([\s\S]*)$/))) {
      const eOpen = s + expr.indexOf('extend(') + 'extend('.length - 1
      const eEnd = findBracketEnd(src, eOpen)
      const extendInner = eEnd !== -1 ? src.slice(eOpen + 1, eEnd) : ''
      registerSchemaDef(file, name, { kind: 'derived', base: dm[1], partial: true, extendInner })
    } else if ((dm = t.match(/^([A-Za-z_$][\w$]*)\s*\.\s*extend\s*\(([\s\S]*)$/))) {
      const eOpen = s + expr.indexOf('extend(') + 'extend('.length - 1
      const eEnd = findBracketEnd(src, eOpen)
      const extendInner = eEnd !== -1 ? src.slice(eOpen + 1, eEnd) : ''
      registerSchemaDef(file, name, { kind: 'derived', base: dm[1], partial: false, extendInner })
    } else if (/^z[.(]/.test(t) || /^zod[.(]/.test(t)) {
      registerSchemaDef(file, name, { kind: 'general', expr })
    } else if ((dm = t.match(/^([A-Za-z_$][\w$]*)$/))) {
      registerSchemaDef(file, name, { kind: 'alias', base: dm[1] })
    }
    re.lastIndex = end
  }
}

/* ------------------------------------------------------------------ */
/* Pass 2: handler declarations per route file                          */
/* ------------------------------------------------------------------ */

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete']

function precedingComment(src, declStart) {
  // Walk back over contiguous // lines, blank lines, and one /** */ block.
  const lines = src.slice(0, declStart).split('\n')
  const collected = []
  let i = lines.length - 1
  // skip trailing blank lines on the declaration's own preceding lines
  while (i >= 0 && lines[i].trim() === '') i--
  // one block comment?
  if (i >= 0 && lines[i].trim().endsWith('*/')) {
    const block = []
    while (i >= 0 && !lines[i].includes('/*')) { block.unshift(lines[i]); i-- }
    if (i >= 0) { block.unshift(lines[i]); i-- }
    collected.unshift(...block)
    while (i >= 0 && lines[i].trim() === '') i--
  }
  const lineComments = []
  while (i >= 0) {
    const t = lines[i].trim()
    if (t.startsWith('//')) { lineComments.unshift(lines[i]); i-- }
    else if (t === '') break
    else break
  }
  collected.unshift(...lineComments)
  return collected.join('\n')
}

function cleanDescription(raw) {
  if (!raw) return ''
  const out = []
  for (const line of raw.split('\n')) {
    let t = line.replace(/^\s*(\/\/\/?|\*)\s?/, '').trim()
    if (!t) continue
    if (/^[─═━\-–*#|/\\ ]+$/.test(t)) continue // decorative separators
    if (/^─+.*─+$/.test(t)) continue
    out.push(t)
  }
  return out.join('\n')
}

function parseRouteFile(file, src) {
  const routerVarMatch = src.match(/export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*Router\(\)/)
  if (!routerVarMatch) { warn(`${file}: no exported Router found`); return [] }
  const routerVar = routerVarMatch[1]

  // Cross-check: every "<routerVar>.<method>(" occurrence must be parsed below.
  const occurrenceRe = new RegExp(`\\b${routerVar}\\.(get|post|put|patch|delete)\\s*\\(`, 'g')
  const occurrences = [...src.matchAll(occurrenceRe)].length

  const handlers = []
  const re = new RegExp(`\\b${routerVar}\\.(get|post|put|patch|delete)\\s*\\(`, 'g')
  let m
  while ((m = re.exec(src)) !== null) {
    const method = m[1]
    const openIdx = m.index + m[0].length - 1
    // path literal
    let j = openIdx + 1
    while (j < src.length && /\s/.test(src[j])) j++
    const q = src[j]
    if (q !== "'" && q !== '"') { warn(`${file}: non-literal path for ${method} at index ${m.index}`); continue }
    const pathEnd = skipQuoted(src, j, q)
    const routePath = unquote(src.slice(j, pathEnd))
    const callEnd = findBracketEnd(src, openIdx)
    if (callEnd === -1) { warn(`${file}: unbalanced call for ${method} ${routePath}`); continue }
    // after path literal expect ','
    let k = pathEnd
    while (k < callEnd && /\s/.test(src[k])) k++
    if (src[k] !== ',') {
      // single-arg form: router.get('/x') without handler — still record
      if (k === callEnd) { handlers.push({ file, method, routePath, middle: [], handlerSrc: '', declStart: m.index, callEnd }); continue }
      warn(`${file}: unexpected token after path for ${method} ${routePath}`)
      continue
    }
    const argsInner = src.slice(k + 1, callEnd)
    const args = splitTopLevel(argsInner).map((a) => a.trim()).filter((a) => a.length)
    const handlerSrc = args.length ? args[args.length - 1] : ''
    const middle = args.slice(0, -1)
    handlers.push({ file, method, routePath, middle, handlerSrc, declStart: m.index, callEnd })
  }
  if (handlers.length !== occurrences) {
    warn(`${file}: parsed ${handlers.length} handlers but found ${occurrences} occurrences — spec may miss routes`)
  }
  // attach segment text (declaration -> next declaration) for body/response scans
  const sorted = handlers
  for (let i = 0; i < sorted.length; i++) {
    const nextStart = i + 1 < sorted.length ? sorted[i + 1].declStart : src.length
    sorted[i].segment = src.slice(sorted[i].declStart, nextStart)
    // Code-only view (comments stripped) for auth/schema/status detection, so
    // docblocks belonging to the *next* handler can't leak into this one.
    sorted[i].code = stripComments(sorted[i].segment)
    sorted[i].comment = precedingComment(src, sorted[i].declStart)
  }
  return handlers
}

/* ------------------------------------------------------------------ */
/* Auth model                                                          */
/* ------------------------------------------------------------------ */

const ROLE_RANK = { readonly: 0, distributor: 1, staff: 2, server: 3, activities: 4, dietary: 5, dietitian: 6, frontdesk: 7, manager: 8, admin: 9 }

function authFromMiddleware(middleTokens, mountAuth) {
  const auth = {
    required: mountAuth,
    mechanism: mountAuth ? 'jwt-bearer' : 'none',
    minRole: null,
    exactRoles: null,
    tier: null,
    rawMiddleware: [],
    inHandlerNote: null,
  }
  for (const tok of middleTokens) {
    const t = tok.trim()
    let m
    if ((m = t.match(/^requireRole\(\s*['"]([^'"]+)['"]\s*\)$/))) {
      auth.required = true
      auth.mechanism = 'jwt-bearer'
      auth.minRole = m[1]
    } else if ((m = t.match(/^requireTier\(\s*['"]([^'"]+)['"]\s*\)$/))) {
      auth.required = true
      if (auth.mechanism === 'none') auth.mechanism = 'license-key'
      auth.tier = m[1]
    } else if (t === 'requireAuth') {
      auth.required = true
      auth.mechanism = 'jwt-bearer'
    } else if (t === 'requireDietitianOrAdmin') {
      auth.required = true
      auth.mechanism = 'jwt-bearer'
      auth.exactRoles = ['dietitian', 'admin']
    } else if (t === 'requireEhrWebhookSignature') {
      auth.required = true
      auth.mechanism = 'ehr-webhook-hmac'
    } else {
      auth.rawMiddleware.push(t.length > 80 ? t.slice(0, 80) + '…' : t)
      warn(`unrecognized middleware token: ${t.slice(0, 80)}`)
    }
  }
  return auth
}

function describeAuth(auth) {
  if (!auth.required) return 'Public — no authentication required.'
  const bits = []
  if (auth.mechanism === 'jwt-bearer') bits.push('JWT Bearer token')
  else if (auth.mechanism === 'ehr-webhook-hmac') bits.push('HMAC-SHA256 webhook signature (X-EHR-Signature header, EHR_WEBHOOK_SECRET)')
  else if (auth.mechanism === 'kiosk-secret') bits.push('Shared secret: Authorization: Bearer <KIOSK_API_SECRET>')
  else if (auth.mechanism === 'stripe-signature') bits.push('Stripe webhook signature (stripe-signature header, STRIPE_WEBHOOK_SECRET)')
  else if (auth.mechanism === 'setup-secret') bits.push('Setup bootstrap secret (x-setup-secret header, SETUP_BOOTSTRAP_SECRET)')
  if (auth.exactRoles) bits.push(`roles: exactly ${auth.exactRoles.join(' or ')} (strict equality, not rank-based)`)
  else if (auth.minRole) {
    const admitted = Object.keys(ROLE_RANK).filter((r) => ROLE_RANK[r] >= ROLE_RANK[auth.minRole])
    bits.push(`minimum role: ${auth.minRole} (admits: ${admitted.join(', ')})`)
  } else if (auth.mechanism === 'jwt-bearer') bits.push('any authenticated role')
  if (auth.tier) bits.push(`license tier: ${auth.tier}+ (402 otherwise)`)
  return 'Authentication: ' + bits.join('; ') + '.'
}

/* ------------------------------------------------------------------ */
/* Handler -> OpenAPI operation                                        */
/* ------------------------------------------------------------------ */

const RESPONSE_DESCRIPTIONS = {
  200: 'Successful response', 201: 'Created', 204: 'No content',
  400: 'Bad request — validation failed', 401: 'Unauthorized',
  402: 'License tier required', 403: 'Forbidden — insufficient role',
  404: 'Not found', 409: 'Conflict', 422: 'Unprocessable entity',
  500: 'Server error', 503: 'Service unavailable — integration not configured',
}

const TAG_DESCRIPTIONS = {
  auth: 'JWT login, MFA, token refresh',
  setup: 'First-time facility initialization (bootstrap secret)',
  billing: 'SaaS licensing estimates and Stripe webhooks',
  residents: 'Resident census, diet orders, NPO and allergen safety',
  audit: 'Immutable audit log',
  menu: 'Cycle menu planning',
  recipes: 'Master recipe book, costing, USDA nutrition',
  production: 'Batch cook sheets and production records',
  admin: 'Users, facility settings, administration',
  kitchen: 'Kiosk, tray-line assembly, QR verification',
  purchasing: 'MRP, vendor splits, invoices, usage rollups',
  inventory: 'Ingredient inventory and counts',
  trayruns: 'Tray-run tracking and SLA monitoring',
  reporting: 'Cost-per-day, CMS survey binder, HACCP logs',
  enterprise: 'PARKED (B13) — multi-site corporate portal',
  ehr: 'PointClickCare EHR sync and reconciliation',
  mcp: 'PARKED (B13) — MCP tool server and self-healing diagnostics',
  webhooks: 'Outbound webhook subscriptions (removed in B13)',
  hardware: 'Thermal printing and HACCP temperature monitoring',
  timecard: 'Kiosk time-clock punches (optional plugin)',
}

function toOpenApiPath(routePath) {
  return routePath.replace(/:([A-Za-z_$][\w$]*)/g, '{$1}')
}

function operationId(method, fullPath) {
  const clean = fullPath.replace(/^\/api\//, '').replace(/[{}]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
  return `${method}_${clean || 'root'}`
}

function detectRequestSchema(segment, file, operationSchemas) {
  // Named schema: ResidentSchema.parse(req.body) / .safeParse(req.body),
  // possibly with .partial()/.omit()/.pick() in between.
  const re = /([A-Za-z_$][\w$]*)((?:\s*\.\s*[A-Za-z_$][\w$]*\s*\([^)]*\))*)\s*\.\s*(parse|safeParse)\s*\(\s*req\.body/
  const m = segment.match(re)
  if (m) {
    const name = m[1]
    const chain = m[2] || ''
    const key = `${file}::${name}`
    const partial = /\.partial\s*\(/.test(chain)
    const shapeMods = []
    if (partial) shapeMods.push('partial')
    const omitM = chain.match(/\.omit\s*\(\s*(\[[^\]]*\])/)
    if (omitM) shapeMods.push(`omit(${omitM[1]})`)
    const pickM = chain.match(/\.pick\s*\(\s*(\[[^\]]*\])/)
    if (pickM) shapeMods.push(`pick(${pickM[1]})`)
    if (!schemaDefs.has(key)) {
      warn(`${file}: request body references undefined schema "${name}"`)
      return null
    }
    return { kind: 'ref', name, partial, shapeMods }
  }
  // Inline z.object({ ... }).parse(req.body)
  const zi = segment.indexOf('z.object(')
  if (zi !== -1) {
    const parseIdx = segment.indexOf('.parse(req.body)', zi)
    if (parseIdx !== -1 && parseIdx - zi < 4000) {
      const openIdx = segment.indexOf('(', zi)
      const endIdx = findBracketEnd(segment, openIdx)
      if (endIdx !== -1 && endIdx < parseIdx) {
        return { kind: 'inline', inner: segment.slice(openIdx + 1, endIdx) }
      }
    }
  }
  return null
}

function schemaNameFor(file, name) {
  // Disambiguate only on cross-file collision.
  const owners = schemaNameOwners.get(name)
  if (owners && owners.size > 1) return `${path.basename(file, '.ts')}_${name}`
  return name
}

function mergeExtraFields(node, extraFields, ctx) {
  for (const f of extraFields) {
    const ft = f.trim()
    if (!ft || ft.startsWith('...')) continue
    const m = ft.match(/^([A-Za-z_$][\w$]*)\s*:\s*([\s\S]+)$/)
    if (!m) continue
    const parsed = zodToSchema(m[2].trim(), ctx)
    node.properties[m[1]] = parsed.node
    if (!parsed.optional) {
      node.required = node.required || []
      if (!node.required.includes(m[1])) node.required.push(m[1])
    }
  }
}

function buildSchemas() {
  const components = {}
  const byKey = new Map(schemaDefs.entries())
  const built = new Map() // key -> node (memo for derived bases)

  function buildDef(def, seen = new Set()) {
    const key = `${def.file}::${def.name}`
    if (built.has(key)) return built.get(key)
    if (seen.has(key)) { warn(`circular schema reference: ${key}`); return {} }
    seen.add(key)
    const ctx = { file: def.file }
    let node
    if (def.kind === 'object') {
      node = objectLiteralToSchema(def.inner, ctx)
      mergeExtraFields(node, def.extraFields, ctx)
    } else if (def.kind === 'general') {
      node = zodToSchema(def.expr, ctx).node
    } else if (def.kind === 'derived') {
      const baseKey = `${def.file}::${def.base}`
      const baseDef = byKey.get(baseKey)
      if (!baseDef || baseDef.kind !== 'object') {
        warn(`${def.file}: derived schema ${def.name} has non-object base ${def.base}`)
        node = { 'x-shoreline-zod': `${def.base}.extend(...)` }
      } else {
        const baseNode = JSON.parse(JSON.stringify(buildDef(baseDef, seen)))
        node = { type: 'object', properties: { ...(baseNode.properties || {}) } }
        if (def.partial) {
          node.required = []
        } else if (baseNode.required) {
          node.required = [...baseNode.required]
        }
        mergeExtraFields(node, splitTopLevel(stripComments(def.extendInner)), ctx)
        if (node.required && !node.required.length) delete node.required
      }
    } else if (def.kind === 'alias') {
      const baseKey = `${def.file}::${def.base}`
      if (byKey.has(baseKey)) node = { $ref: `#/components/schemas/${schemaNameFor(def.file, def.base)}` }
      else node = { 'x-shoreline-zod': def.base }
    } else {
      node = {}
    }
    built.set(key, node)
    return node
  }

  const ordered = [...schemaDefs.values()].sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file))
  for (const def of ordered) {
    const outName = schemaNameFor(def.file, def.name)
    if (components[outName]) continue
    components[outName] = buildDef(def)
  }
  return components
}

function handlerToOperation(h, mount, schemas, fileParked) {
  let fullPath = toOpenApiPath(mount.base + h.routePath)
  if (fullPath.length > 1) fullPath = fullPath.replace(/\/+$/, '') // '/api/residents/' -> '/api/residents'
  const mountAuth = mount.middle.some((t) => t.trim() === 'requireAuth')
  const auth = authFromMiddleware(h.middle, mountAuth)

  // In-handler auth patterns the middleware scan cannot see
  const seg = h.code
  if (/\brequireSetupSecret\s*\(/.test(seg)) {
    auth.required = true
    auth.mechanism = 'setup-secret'
  }
  if (/KIOSK_API_SECRET/.test(seg) && /req\.headers\.authorization/.test(seg)) {
    auth.required = true
    auth.mechanism = 'kiosk-secret'
  }
  if (/STRIPE_WEBHOOK_SECRET/.test(seg) || /verifyStripeWebhookSignature/.test(seg)) {
    auth.required = true
    auth.mechanism = 'stripe-signature'
  }
  if (/canWriteDietOrder/.test(seg)) {
    auth.inHandlerNote = 'In-handler gate: clinical/diet-order fields require the dietitian or manager role (strict role equality); other fields follow the middleware role above.'
  }
  if (!auth.required && /jwt\.verify\s*\(/.test(seg)) {
    auth.required = true
    auth.mechanism = 'jwt-bearer'
    auth.inHandlerNote = 'In-handler JWT verification (not via requireAuth middleware); anonymous or bad-token calls are rejected in the handler.'
  }

  const tag = mount.base.replace(/^\/api\//, '').split('/')[0]
  const description = cleanDescription(h.comment)
  const summary = (description.split('\n')[0] || `${h.method.toUpperCase()} ${fullPath}`).slice(0, 140)

  const parameters = []
  for (const pm of h.routePath.matchAll(/:([A-Za-z_$][\w$]*)/g)) {
    parameters.push({ name: pm[1], in: 'path', required: true, schema: { type: 'string' } })
  }
  const queryParams = new Set()
  for (const qm of seg.matchAll(/req\.query\.([A-Za-z_$][\w$]*)/g)) queryParams.add(qm[1])
  for (const dm of seg.matchAll(/(?:const|let|var)\s*{\s*([^}]*?)}\s*=\s*req\.query\b/g)) {
    for (const part of dm[1].split(',')) {
      const pm = part.trim().match(/^([A-Za-z_$][\w$]*)/)
      if (pm) queryParams.add(pm[1])
    }
  }
  for (const qp of [...queryParams].sort()) {
    parameters.push({ name: qp, in: 'query', required: false, schema: { type: 'string' }, description: 'Query parameter read by the handler.' })
  }
  const op = {
    operationId: operationId(h.method, fullPath),
    summary,
    tags: [tag],
  }
  if (parameters.length) op.parameters = parameters
  if (description) op.description = description + '\n\n' + describeAuth(auth)
  else op.description = describeAuth(auth)

  const schemaRef = detectRequestSchema(seg, h.file, schemas)
  if (schemaRef && ['post', 'put', 'patch'].includes(h.method)) {
    if (schemaRef.kind === 'ref') {
      const outName = schemaNameFor(h.file, schemaRef.name)
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${outName}` } } },
      }
      if (schemaRef.partial || schemaRef.shapeMods.length) {
        op.requestBody['x-shoreline-shape'] = schemaRef.shapeMods.join(', ') || 'partial'
      }
    } else {
      const inlineName = `${operationId(h.method, fullPath)}_Body`
      schemas[inlineName] = objectLiteralToSchema(schemaRef.inner, { file: h.file })
      op.requestBody = {
        required: true,
        content: { 'application/json': { schema: { $ref: `#/components/schemas/${inlineName}` } } },
      }
    }
  }

  // Responses: explicit res.status(n) codes + auth-implied codes
  const codes = new Set()
  for (const sm of seg.matchAll(/res\.(?:status|sendStatus)\(\s*(\d{3})\s*\)/g)) codes.add(Number(sm[1]))
  const responses = {}
  const successCodes = [...codes].filter((c) => c >= 200 && c < 300).sort()
  const primary = successCodes[0] || 200
  responses[String(primary)] = { description: RESPONSE_DESCRIPTIONS[primary] || 'Successful response' }
  for (const c of [...codes].filter((c) => c >= 400).sort()) {
    responses[String(c)] = { description: RESPONSE_DESCRIPTIONS[c] || `Error ${c}` }
  }
  if (auth.required && auth.mechanism === 'jwt-bearer' && !responses['401']) {
    responses['401'] = { description: RESPONSE_DESCRIPTIONS[401] }
  }
  if ((auth.minRole || auth.exactRoles || auth.inHandlerNote) && !responses['403']) {
    responses['403'] = { description: RESPONSE_DESCRIPTIONS[403] }
  }
  if (auth.tier && !responses['402']) responses['402'] = { description: RESPONSE_DESCRIPTIONS[402] }
  if (auth.mechanism === 'kiosk-secret' || auth.mechanism === 'setup-secret' || auth.mechanism === 'ehr-webhook-hmac') {
    if (!responses['401']) responses['401'] = { description: 'Unauthorized — invalid or missing shared secret / signature' }
  }
  op.responses = responses

  // Security
  const schemeFor = {
    'jwt-bearer': [{ bearerAuth: [] }],
    'ehr-webhook-hmac': [{ ehrWebhookSignature: [] }],
    'kiosk-secret': [{ kioskApiSecret: [] }],
    'stripe-signature': [{ stripeWebhookSignature: [] }],
    'setup-secret': [{ setupSecret: [] }],
    none: [],
  }
  op.security = schemeFor[auth.mechanism] || []

  const xAuth = { required: auth.required, mechanism: auth.mechanism }
  if (auth.minRole) xAuth.minRole = auth.minRole
  if (auth.exactRoles) xAuth.exactRoles = auth.exactRoles
  if (auth.tier) xAuth.tier = auth.tier
  if (auth.inHandlerNote) xAuth.note = auth.inHandlerNote
  if (auth.rawMiddleware.length) xAuth.additionalMiddleware = auth.rawMiddleware
  op['x-shoreline-auth'] = xAuth

  if (fileParked) {
    op.deprecated = true
    op['x-shoreline-status'] = 'parked — B13 scope cut; code stays mounted and compiling, no UI surface reaches it'
  }
  if (mount.conditional) op['x-shoreline-conditional'] = mount.conditional
  if (/@deprecated/i.test(h.comment)) op.deprecated = true

  return { fullPath, method: h.method, op }
}

/* ------------------------------------------------------------------ */
/* Assemble + write                                                   */
/* ------------------------------------------------------------------ */

function isParkedFile(file, src) {
  return /^\/\*\*[\s\S]{0,400}?PARKED/.test(src)
}

function main() {
  const indexSrc = fs.readFileSync(INDEX_TS, 'utf8')
  const mounts = parseMounts(indexSrc)
  if (!mounts.length) { console.error('FATAL: no router mounts parsed from src/index.ts'); process.exit(2) }

  const files = fs.readdirSync(ROUTES_DIR).filter((f) => f.endsWith('.ts')).sort()
  const srcByFile = new Map(files.map((f) => [f, fs.readFileSync(path.join(ROUTES_DIR, f), 'utf8')]))

  for (const f of files) collectSchemaDefs(f, srcByFile.get(f))

  const schemas = buildSchemas()

  const paths = {}
  let handlerCount = 0
  const seenOps = new Set()
  for (const mount of mounts) {
    const file = mount.routerVar.replace(/Router$/, '') + '.ts'
    // routerVar -> file name mapping: residentsRouter -> residents.ts (with exceptions)
    const candidates = [file, ...files.filter((f) => f.replace(/\.ts$/, '') + 'Router' === mount.routerVar)]
    const target = candidates.find((c) => srcByFile.has(c))
    if (!target) { warn(`no route file found for mount ${mount.base} (${mount.routerVar})`); continue }
    const src = srcByFile.get(target)
    const parked = isParkedFile(target, src)
    const handlers = parseRouteFile(target, src)
    for (const h of handlers) {
      handlerCount++
      const { fullPath, method, op } = handlerToOperation(h, mount, schemas, parked)
      if (!paths[fullPath]) paths[fullPath] = {}
      if (paths[fullPath][method]) warn(`duplicate route: ${method.toUpperCase()} ${fullPath}`)
      paths[fullPath][method] = op
      seenOps.add(`${method} ${fullPath}`)
    }
  }

  // App-level API routes registered directly in index.ts (infra probes excluded)
  paths['/api/health'] = {
    get: {
      operationId: 'get_api_health',
      summary: 'Service health probe',
      description: 'Authentication: Public — no authentication required.\nReturns service health status. Registered directly in src/index.ts.',
      tags: ['health'],
      responses: { 200: { description: 'Successful response' } },
      security: [],
      'x-shoreline-auth': { required: false, mechanism: 'none' },
    },
  }

  const sortedPaths = {}
  for (const p of Object.keys(paths).sort()) {
    sortedPaths[p] = {}
    for (const m of HTTP_METHODS.filter((mm) => paths[p][mm])) sortedPaths[p][m] = paths[p][m]
  }
  const sortedSchemas = {}
  for (const k of Object.keys(schemas).sort()) sortedSchemas[k] = schemas[k]

  const tags = [...new Set(Object.values(sortedPaths).flatMap((ops) => Object.values(ops).flatMap((op) => op.tags)))].sort()
    .map((t) => ({ name: t, description: TAG_DESCRIPTIONS[t] || `${t} endpoints` }))

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'Shoreline Care OS API',
      version: '6.2.0',
      description: 'Open-source dietary, clinical nutrition, and food operations platform API for care facilities. Generated from the Express route definitions by server/scripts/generate-openapi.mjs — do not edit by hand; run `npm run docs:generate` in server/.',
    },
    servers: [
      { url: 'http://localhost:3001/api', description: 'Local Facility Gateway' },
      { url: 'https://api.shorelineops.com/api', description: 'Enterprise Cloud Sync' },
    ],
    tags,
    paths: sortedPaths,
    components: {
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT issued by POST /api/auth/login. Role claim gates requireRole ranks.' },
        ehrWebhookSignature: { type: 'apiKey', in: 'header', name: 'X-EHR-Signature', description: 'HMAC-SHA256 of the raw body with EHR_WEBHOOK_SECRET.' },
        kioskApiSecret: { type: 'apiKey', in: 'header', name: 'Authorization', description: 'Bearer <KIOSK_API_SECRET> for kiosk punch webhooks.' },
        stripeWebhookSignature: { type: 'apiKey', in: 'header', name: 'stripe-signature', description: 'Stripe webhook signature with STRIPE_WEBHOOK_SECRET.' },
        setupSecret: { type: 'apiKey', in: 'header', name: 'x-setup-secret', description: 'SETUP_BOOTSTRAP_SECRET for first-time facility initialization.' },
      },
      schemas: sortedSchemas,
    },
    'x-shoreline-generated': {
      generator: 'server/scripts/generate-openapi.mjs',
      source: 'static parse of server/src/index.ts mounts and server/src/routes/*.ts handlers',
      handlerCount,
    },
  }

  const out = JSON.stringify(spec, null, 2) + '\n'

  if (CHECK_MODE) {
    let current = null
    try { current = fs.readFileSync(OUT_PATH, 'utf8') } catch { /* missing */ }
    if (current === out) {
      console.log(`openapi.json is in sync (${handlerCount} handlers).`)
      process.exit(warnings.length ? 0 : 0)
    }
    console.error(`DRIFT: generated spec differs from ${path.relative(SERVER_DIR, OUT_PATH)}`)
    if (current == null) {
      console.error('(checked-in spec is missing)')
    } else {
      const a = current.split('\n'), b = out.split('\n')
      let shown = 0
      for (let i = 0; i < Math.max(a.length, b.length) && shown < 20; i++) {
        if (a[i] !== b[i]) {
          console.error(`line ${i + 1}:\n  - ${a[i] ?? '(eof)'}\n  + ${b[i] ?? '(eof)'}`)
          shown++
        }
      }
    }
    process.exit(1)
  }

  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true })
  fs.writeFileSync(OUT_PATH, out)
  console.log(`wrote ${path.relative(SERVER_DIR, OUT_PATH)} (${handlerCount} handlers, ${Object.keys(sortedSchemas).length} schemas)`)
  if (warnings.length) {
    console.error(`\nwarnings (${warnings.length}):`)
    for (const w of [...new Set(warnings)].slice(0, 40)) console.error('  - ' + w)
  }
}

main()
