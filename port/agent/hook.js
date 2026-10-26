/*
 * K12Online Hack — Android port of k12onlinehack.user.js
 *
 * Runs inside vn.viettelstudy.k12 via frida-gadget. The Flutter app renders
 * exams natively, so instead of scraping the DOM we read the exam JSON off
 * BoringSSL inside libflutter.so (the same payload the web page embeds in
 * LMS.Learning.Courseware.Exam), extract the marked answers, and draw a
 * floating panel over the app.
 *
 * Engine: Flutter 3.41.2 / Dart 3.11.0 (build id fc84702ceb4ef3082433a3a76c506f6532c31c3b).
 * Offsets below are from the matching android-arm64 release symbols.
 */
'use strict';

var SSL_READ_OFFSET = 0x73d108;   // SSL_read
var SSL_PROLOGUE = 'ff0306d1';    // sub sp, sp, #0x180
var MAX_BODY = 8 * 1024 * 1024;

var log = function (m) {
    var line = '[k12port] ' + m;
    try { console.log(line); } catch (e) {}
    try {
        Java.perform(function () { Java.use('android.util.Log').e('k12port', line); });
    } catch (e) {}
};

/* ------------------------------------------------------------------ */
/* Ported from k12onlinehack.user.js                                    */
/* ------------------------------------------------------------------ */

var MARKER = /['"]LMS\.Learning\.Courseware\.Exam['"]\s*,/;

function sliceBalanced(text, start, open, close) {
    var depth = 0;
    var quote = null;
    var escaped = false;

    for (var i = start; i < text.length; i++) {
        var ch = text[i];

        if (quote) {
            if (escaped) escaped = false;
            else if (ch === '\\') escaped = true;
            else if (ch === quote) quote = null;
            continue;
        }

        if (ch === '"' || ch === "'" || ch === '`') { quote = ch; continue; }

        if (ch === open) depth++;
        else if (ch === close) {
            depth--;
            if (depth === 0) return text.slice(start, i + 1);
        }
    }
    return null;
}

function parseJsonLoose(text) {
    try { return JSON.parse(text); }
    catch (e) { return JSON.parse(text.replace(/,\s*([}\]])/g, '$1')); }
}

function extractItems(html) {
    var from = 0;

    while (from < html.length) {
        var rel = MARKER.exec(html.slice(from));
        if (!rel) return null;

        var at = from + rel.index;
        var after = html.slice(at);
        var relItems = /\bitems\s*:\s*\[/.exec(after);

        if (relItems) {
            var arrStart = at + relItems.index + relItems[0].length - 1;
            var arrText = sliceBalanced(html, arrStart, '[', ']');

            if (arrText) {
                try {
                    var arr = parseJsonLoose(arrText);
                    if (Array.isArray(arr)) return { items: arr };
                } catch (e) { /* keep looking */ }
            }
        }

        from = at + rel[0].length;
    }
    return null;
}

var LOWER = 'abcdefghijklmnopqrstuvwxyz';
var UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

var raw = function (v) { return v == null ? '' : String(v).trim(); };

var ENTITIES = {
    amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
    hellip: '\u2026', mdash: '\u2014', ndash: '\u2013', laquo: '\u00ab', raquo: '\u00bb',
};

function decodeEntities(s) {
    return s.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, function (m, e) {
        if (e[0] === '#') {
            var n = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return isFinite(n) ? String.fromCharCode(n) : m;
        }
        var v = ENTITIES[e.toLowerCase()];
        return v == null ? m : v;
    });
}

// DOMParser is not available in Frida; this is the same block/BR/newline logic.
function htmlToText(html) {
    if (!/[<&]/.test(html)) return html;

    return decodeEntities(
        html
            .replace(/<br\s*\/?>/gi, '\n')
            .replace(/<\/(p|div|li|ul|ol|dl|dd|dt|tr|td|th|table|h[1-6]|blockquote|pre|section|article|header|footer|figure|figcaption|hr|address)>/gi, '\n')
            .replace(/<[^>]*>/g, '')
    )
        .replace(/[ \t\u00a0]+/g, ' ')
        .replace(/ ?\n ?/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

var txt = function (v) { return htmlToText(raw(v)); };

function labelLower(i) { return LOWER[i] || String(i + 1); }
function labelUpper(i) { return UPPER[i] || String(i + 1); }

function markedPoint(point) {
    var s = txt(point).replace(',', '.');
    if (!s) return false;
    var n = Number(s);
    return isFinite(n) ? n > 0 : false;
}

var isTrueValue = function (v) { return /^(true|1|đúng|dung|yes|t|đ)$/i.test(txt(v)); };
var isFalseValue = function (v) { return /^(false|0|sai|no|f|s)$/i.test(txt(v)); };

function choiceEntries(choices) {
    if (!choices) return [];

    if (Array.isArray(choices)) {
        return choices.map(function (v) { return { value: v || {} }; });
    }
    if (typeof choices !== 'object') return [];

    return Object.keys(choices)
        .sort(function (a, b) {
            var na = parseInt(a, 10);
            var nb = parseInt(b, 10);
            if (isFinite(na) && isFinite(nb) && na !== nb) return na - nb;
            return a.localeCompare(b);
        })
        .map(function (key) { return { value: choices[key] || {} }; });
}

// The app renders choices in the order the array arrives. answerCode (and the
// `pos` array, which just mirrors it) is the answer-sheet bubble, not the
// on-screen position, so it must not be used for sorting.
function orderedEntries(item) {
    return choiceEntries(item && item.choices);
}

function truncate(s, n) { return s.length > n ? s.slice(0, n - 1) + '\u2026' : s; }

// The web payload marks the key with point > 0. Some API builds use a boolean.
function isMarked(value) {
    if (markedPoint(value.point)) return true;
    return value.isCorrect === true || value.correct === true || value.right === true;
}

function classify(item) {
    var type = txt(item && item.elementType);
    var keys = Object.keys(item || {});

    if (keys.some(function (k) { return /^answerText\d+$/i.test(k); })) return 'short';

    var entries = choiceEntries(item && item.choices);
    if (/truefalse|true_false|^tf|OnlyTrueFalse/i.test(type)) return 'truefalse';
    if (
        entries.length > 0 &&
        entries.every(function (e) {
            return isTrueValue(e.value.answerTitle) || isFalseValue(e.value.answerTitle);
        })
    ) {
        return 'truefalse';
    }

    if (entries.length > 0) return 'choice';
    return 'unknown';
}

// Group children come as {answerTitle, options:[{answerCode, title}], answer},
// where `answer` is the answerCode of the key option and options are on-screen
// order (A, B, C, ...), same as normal choices.
function describeChild(item) {
    var key = txt(item.answer);
    var opts = item.options.map(function (o, i) {
        return {
            label: labelUpper(i),
            text: txt(o.title),
            marked: String(o.answerCode) === key,
        };
    });
    var marked = opts.filter(function (o) { return o.marked; });

    return {
        index: Number(item.questionIndex) || 0,
        kind: 'choice',
        title: txt(item.answerTitle) || txt(item.textTitle) || txt(item.title),
        note: txt(item.answerDescription),
        answer: marked.length
            ? marked.map(function (o) { return o.label + '. ' + truncate(o.text, 60); }).join(' | ')
            : '\u2014',
        options: opts,
        statements: [],
        parts: [],
        lettered: true,
    };
}

function describeItem(item) {
    if (Array.isArray(item && item.options) && item.answer != null) return describeChild(item);

    var kind = classify(item);
    var out = {
        index: Number(item.questionIndex) || 0,
        kind: kind,
        title: txt(item.textTitle) || txt(item.title),
        note: txt(item.answerDescription),
        answer: '\u2014',
        options: [],
        statements: [],
        parts: [],
    };

    if (kind === 'choice') {
        var entries = orderedEntries(item);

        // The app's option text has no label of its own (unlike the web page's
        // "B. 4"), so number them the way the exam does: A, B, C, D.
        out.lettered = entries.some(function (e) { return txt(e.value.answerCode) !== ''; });
        out.options = entries.map(function (e, i) {
            return {
                label: labelUpper(i),
                text: txt(e.value.answerTitle),
                marked: isMarked(e.value),
            };
        });
        var marked = out.options.filter(function (o) { return o.marked; });
        out.answer = marked.length
            ? marked.map(function (o) {
                return out.lettered ? o.label + '. ' + truncate(o.text, 60) : o.text;
            }).join(' | ')
            : '\u2014';
    } else if (kind === 'truefalse') {
        out.statements = orderedEntries(item).map(function (e, i) {
            var val = txt(e.value.answerTitle);
            var truth = null;

            if (isTrueValue(val)) truth = true;
            else if (isFalseValue(val)) truth = false;
            else if (txt(e.value.point) !== '') truth = markedPoint(e.value.point);

            return { label: labelLower(i), truth: truth, text: txt(e.value.questionTitle) };
        });

        out.answer = out.statements
            .map(function (s) { return s.label + '. ' + (s.truth === true ? '\u0110' : s.truth === false ? 'S' : '?'); })
            .join('  ');
    } else if (kind === 'short') {
        out.parts = Object.keys(item)
            .filter(function (k) { return /^answerText\d+$/i.test(k); })
            .sort(function (a, b) { return Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]); })
            .map(function (k) { return { key: k, value: txt(item[k]) }; });

        out.answer = out.parts.map(function (p) { return p.value; }).join('');
    } else if (txt(item.answerText)) {
        out.answer = truncate(txt(item.answerText), 200);
    }

    return out;
}

// Reading exams group a passage with its sub-questions: the group's `choices`
// are the questions themselves, each with {answerTitle, options[], answer}.
function isGroup(item) {
    var entries = choiceEntries(item && item.choices);
    if (entries.length === 0) return false;

    return entries.every(function (e) {
        return !!e.value && Array.isArray(e.value.options);
    });
}

function buildReport(items) {
    var groups = [];
    var byName = {};

    function add(item, fallbackName) {
        if (isGroup(item)) {
            var fallback = txt(item.partTitle) || txt(item.elementTypeTitle) || fallbackName;
            choiceEntries(item.choices).forEach(function (e) { add(e.value, fallback); });
            return;
        }

        var name = txt(item.partTitle) || txt(item.elementTypeTitle) || fallbackName || 'C\u00e2u h\u1ecfi';
        var group = byName[name];

        if (!group) {
            group = { name: name, questions: [] };
            byName[name] = group;
            groups.push(group);
        }
        group.questions.push(describeItem(item));
    }

    for (var i = 0; i < items.length; i++) add(items[i]);

    var n = 0;
    groups.forEach(function (g) {
        g.questions.forEach(function (q) {
            n++;
            if (!q.index) q.index = n;
        });
    });

    return { groups: groups, itemCount: n };
}

function reportText(report) {
    var lines = ['K12Online Hack \u2014 ' + report.itemCount + ' c\u00e2u'];

    report.groups.forEach(function (g) {
        lines.push('', '[' + g.name + ']');
        g.questions.forEach(function (q) {
            var n = q.index || '?';
            var answer = q.answer || '?';

            if (q.kind === 'short' && q.parts.length > 1) {
                answer += '   (' + q.parts.map(function (p) { return p.value === '' ? '\u2205' : p.value; }).join(' | ') + ')';
            }

            lines.push(n + '. ' + answer);
        });
    });

    return lines.join('\n');
}

// Sections also carry elementType/choices, so only real questions count.
function isQuestion(x) {
    return !!x && typeof x === 'object' && (x.questionIndex != null || x.textTitle != null);
}

// Find the items array inside an arbitrary API envelope.
function findItems(node, depth) {
    if (!node || depth > 10) return null;

    if (Array.isArray(node)) {
        if (node.length > 0 && node.every(isQuestion)) return node;
        for (var i = 0; i < node.length; i++) {
            var r = findItems(node[i], depth + 1);
            if (r) return r;
        }
        return null;
    }

    if (typeof node === 'object') {
        var keys = Object.keys(node);
        for (var k = 0; k < keys.length; k++) {
            var found = findItems(node[keys[k]], depth + 1);
            if (found) return found;
        }
    }

    return null;
}

function extractReport(text) {
    // Plain JSON API response (the app's normal path).
    if (/^\s*[\[{]/.test(text)) {
        try {
            var data = JSON.parse(text);
            var items = findItems(data, 0);
            if (items) return buildReport(items);
        } catch (e) { /* fall through to the web payload parser */ }
    }

    // Same embedded config the userscript reads from the web page.
    var found = extractItems(text);
    if (found) return buildReport(found.items);

    return null;
}

/* ------------------------------------------------------------------ */
/* TLS capture                                                          */
/* ------------------------------------------------------------------ */

function concatChunks(chunks) {
    var len = 0;
    for (var i = 0; i < chunks.length; i++) len += chunks[i].length;

    var out = new Uint8Array(len);
    var off = 0;
    for (var j = 0; j < chunks.length; j++) {
        out.set(chunks[j], off);
        off += chunks[j].length;
    }
    return out;
}

function indexOfSeq(bytes, seq, from) {
    from = from || 0;
    outer:
    for (var i = from; i <= bytes.length - seq.length; i++) {
        for (var j = 0; j < seq.length; j++) {
            if (bytes[i + j] !== seq[j]) continue outer;
        }
        return i;
    }
    return -1;
}

// No Buffer/TextDecoder in Frida's QuickJS runtime.
function utf8(bytes) {
    var out = '';
    var i = 0;

    while (i < bytes.length) {
        var c = bytes[i++];

        if (c < 0x80) out += String.fromCharCode(c);
        else if (c < 0xe0) out += String.fromCharCode(((c & 0x1f) << 6) | (bytes[i++] & 0x3f));
        else if (c < 0xf0) {
            out += String.fromCharCode(((c & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f));
        } else {
            var cp = ((c & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
            cp -= 0x10000;
            out += String.fromCharCode(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
        }
    }
    return out;
}

function inflate(bytes, gzip) {
    var ByteArrayInputStream = Java.use('java.io.ByteArrayInputStream');
    var ByteArrayOutputStream = Java.use('java.io.ByteArrayOutputStream');
    var Stream = Java.use(gzip ? 'java.util.zip.GZIPInputStream' : 'java.util.zip.InflaterInputStream');

    var input = ByteArrayInputStream.$new(Java.array('byte', Array.prototype.slice.call(bytes)));
    var z = Stream.$new(input);
    var out = ByteArrayOutputStream.$new();
    var buf = Java.array('byte', new Array(16384).fill(0));

    try {
        var n;
        while ((n = z.read(buf, 0, buf.length)) > 0) out.write(buf, 0, n);
    } finally {
        z.close();
    }

    var result = out.toByteArray();
    var decoded = new Uint8Array(result.length);
    for (var i = 0; i < result.length; i++) decoded[i] = result[i] & 0xff;
    return decoded;
}

var streams = {};
var pending = [];

function handleBody(headers, body) {
    if (!body || body.length === 0 || body.length > MAX_BODY) return;

    var type = (headers['content-type'] || '').toLowerCase();
    if (type && !/json|text|html|javascript|xml/.test(type)) return;

    try {
        var encoding = (headers['content-encoding'] || '').toLowerCase();
        if (/gzip/.test(encoding) || (body.length > 2 && body[0] === 0x1f && body[1] === 0x8b)) body = inflate(body, true);
        else if (/deflate/.test(encoding)) body = inflate(body, false);

        var text = utf8(body);
        if (!/"choices"/i.test(text) && !/"elementType"/i.test(text) && !MARKER.test(text)) return;

        var report = extractReport(text);
        if (report && report.itemCount > 0) {
            log('report: ' + report.itemCount + ' items');
            showReport(report);
        }
    } catch (e) {
        log('body: ' + e);
    }
}

function parseChunked(bytes, start) {
    var pos = start;
    var parts = [];

    while (pos < bytes.length) {
        var lineEnd = indexOfSeq(bytes, [13, 10], pos);
        if (lineEnd < 0) return null;

        var size = parseInt(utf8(bytes.subarray(pos, lineEnd)).split(';')[0].trim(), 16);
        if (!isFinite(size)) return null;
        pos = lineEnd + 2;

        if (size === 0) {
            var end = indexOfSeq(bytes, [13, 10], pos);
            if (end < 0) return null;
            return { body: concatChunks(parts), consumed: end + 2 };
        }

        if (pos + size + 2 > bytes.length) return null;
        parts.push(bytes.subarray(pos, pos + size));
        pos += size + 2;
    }
    return null;
}

function drain(key) {
    var s = streams[key];
    if (!s || !s.bytes.length) return;

    var bytes = s.bytes;

    for (;;) {
        var headEnd = indexOfSeq(bytes, [13, 10, 13, 10]);
        if (headEnd < 0) {
            s.bytes = bytes.length > 65536 ? new Uint8Array(0) : bytes;
            return;
        }

        var head = utf8(bytes.subarray(0, headEnd));
        var status = /^HTTP\/1\.[01] (\d{3})/.exec(head);

        if (!status) {
            var next = indexOfSeq(bytes, [72, 84, 84, 80, 47]); // HTTP/
            if (next > 0) { bytes = bytes.subarray(next); continue; }
            s.bytes = new Uint8Array(0);
            return;
        }

        var headers = {};
        var lines = head.split('\r\n');
        for (var i = 1; i < lines.length; i++) {
            var p = lines[i].indexOf(':');
            if (p > 0) headers[lines[i].slice(0, p).trim().toLowerCase()] = lines[i].slice(p + 1).trim();
        }

        var bodyStart = headEnd + 4;
        var code = Number(status[1]);

        if (/chunked/i.test(headers['transfer-encoding'] || '')) {
            var chunked = parseChunked(bytes, bodyStart);
            if (!chunked) { s.bytes = bytes; return; }
            if (code >= 200 && code < 300) pending.push({ headers: headers, body: chunked.body });
            bytes = bytes.subarray(chunked.consumed);
            continue;
        }

        if (headers['content-length']) {
            var len = parseInt(headers['content-length'], 10) || 0;
            if (bytes.length < bodyStart + len) { s.bytes = bytes; return; }
            if (code >= 200 && code < 300) {
                pending.push({ headers: headers, body: bytes.subarray(bodyStart, bodyStart + len) });
            }
            bytes = bytes.subarray(bodyStart + len);
            continue;
        }

        // No length: only trust small JSON-ish bodies (connection close responses).
        if (code >= 200 && code < 300) pending.push({ headers: headers, body: bytes.subarray(bodyStart) });
        s.bytes = new Uint8Array(0);
        return;
    }
}

function feed(ssl, buffer, length) {
    var key = ssl.toString();
    var s = streams[key];

    if (!s) {
        s = { bytes: new Uint8Array(0) };
        streams[key] = s;
    }

    var chunk = new Uint8Array(buffer.readByteArray(length));

    if (s.bytes.length + length > MAX_BODY * 2) s.bytes = new Uint8Array(0);

    var merged = new Uint8Array(s.bytes.length + length);
    merged.set(s.bytes, 0);
    merged.set(chunk, s.bytes.length);
    s.bytes = merged;

    try { drain(key); } catch (e) { log('drain: ' + e); }
}

var hooked = false;

function hookFlutter() {
    if (hooked) return;

    var mod = Process.findModuleByName('libflutter.so');
    if (!mod) { setTimeout(hookFlutter, 250); return; }

    var address = mod.base.add(SSL_READ_OFFSET);
    var prologue = address.readByteArray(4);
    var prologueHex = '';
    if (prologue) {
        var bytes = new Uint8Array(prologue);
        for (var i = 0; i < bytes.length; i++) prologueHex += ('0' + bytes[i].toString(16)).slice(-2);
    }

    if (prologueHex !== SSL_PROLOGUE) {
        log('unexpected libflutter build (' + prologueHex + '), not hooking');
        return;
    }

    Interceptor.attach(address, {
        onEnter: function (args) {
            this.buf = args[1];
            this.ssl = args[0];
        },
        onLeave: function (retval) {
            var n = retval.toInt32();
            if (n > 0) {
                try { feed(this.ssl, this.buf, n); } catch (e) { log('feed: ' + e); }
            }
        },
    });

    hooked = true;
    log('hooked SSL_read at ' + address);
}

/* ------------------------------------------------------------------ */
/* Overlay                                                              */
/* ------------------------------------------------------------------ */

var currentActivity = null;
var reportJson = '';
var uiPending = false;

var ui = {
    activity: null,
    web: null,
    fab: null,
    fabBg: null,
    loaded: false,
    shown: false,
    renderedJson: '',
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    screenW: 0,
    screenH: 0,
    density: 1,
    drag: false,
    dragX: 0,
    dragY: 0,
    startLeft: 0,
    startTop: 0,
};

// Frida 17 does not auto-convert JS strings for CharSequence parameters.
function jstr(s) { return Java.use('java.lang.String').$new(s); }

function dp(n) { return Math.round(n * ui.density); }

/* Theme and hue survive restarts; panel position does not. */
function prefs() { return currentActivity.getSharedPreferences('k12port', 0); }

function savedTheme() {
    try {
        var v = prefs().getString('theme', null);
        return v ? String(v) : null;
    } catch (e) { return null; }
}

function savedHue() {
    try {
        var n = prefs().getInt('hue', -1);
        return n >= 0 ? n : null;
    } catch (e) { return null; }
}

function saveUi(theme, hue) {
    try {
        var edit = prefs().edit();
        if (theme) edit.putString('theme', theme);
        if (hue >= 0) edit.putInt('hue', hue);
        edit.apply();
    } catch (e) { log('prefs: ' + e); }
}

// The FAB is the panel's brand bubble, so it uses the same two roles
// (primary-container / on-primary-container) from the panel's SCHEME.
var FAB_ROLES = {
    light: { bg: [0.92, 0.055, 0], fg: [0.30, 0.095, 0] },
    dark: { bg: [0.36, 0.11, 0], fg: [0.92, 0.05, 0] },
};

// oklch -> sRGB hex (Björn Ottosson's Oklab matrices), same math as the page.
function oklchHex(L, C, hDeg) {
    var h = hDeg * Math.PI / 180;
    var a = C * Math.cos(h);
    var b = C * Math.sin(h);
    var l_ = L + 0.3963377774 * a + 0.2158037573 * b;
    var m_ = L - 0.1055613458 * a - 0.0638541728 * b;
    var s_ = L - 0.0894841775 * a - 1.2914855480 * b;
    var l = l_ * l_ * l_;
    var m = m_ * m_ * m_;
    var s = s_ * s_ * s_;
    var rgb = [
        4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
        -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
        -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s,
    ];
    var out = '#';

    for (var i = 0; i < 3; i++) {
        var v = rgb[i];
        v = v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        v = Math.round(Math.max(0, Math.min(1, v)) * 255);
        out += (v < 16 ? '0' : '') + v.toString(16);
    }

    return out;
}

function fabColors() {
    var mode = savedTheme();
    if (!mode) {
        var night = false;
        try {
            var Configuration = Java.use('android.content.res.Configuration');
            var cfg = currentActivity.getResources().getConfiguration();
            night = (cfg.uiMode.value & Configuration.UI_MODE_NIGHT_YES.value) ===
                Configuration.UI_MODE_NIGHT_YES.value;
        } catch (e) {}
        mode = night ? 'dark' : 'light';
    }

    var roles = FAB_ROLES[mode] || FAB_ROLES.light;
    var hue = savedHue();
    if (hue === null) hue = 265;

    return {
        bg: oklchHex(roles.bg[0], roles.bg[1], (hue + roles.bg[2]) % 360),
        fg: oklchHex(roles.fg[0], roles.fg[1], (hue + roles.fg[2]) % 360),
    };
}

function paintFab() {
    if (!ui.fab || !ui.fabBg) return;

    try {
        var colors = fabColors();
        var Color = Java.use('android.graphics.Color');
        ui.fabBg.setColor(Color.parseColor(colors.bg));
        ui.fab.setTextColor(Color.parseColor(colors.fg));
    } catch (e) { log('fab color: ' + e); }
}

function showReport(report) {
    reportJson = JSON.stringify(report);
    ui.shown = true;
    postUi();
}

function postUi() {
    if (!currentActivity) return;

    try {
        Java.perform(function () {
            if (uiPending) return;
            uiPending = true;

            var Handler = Java.use('android.os.Handler');
            var Looper = Java.use('android.os.Looper');
            var Runnable = Java.use('java.lang.Runnable');

            var Runner = Java.registerClass({
                name: 'k12.port.Ui' + (Date.now() % 100000),
                implements: [Runnable],
                methods: {
                    run: function () {
                        uiPending = false;
                        try { uiSync(); } catch (e) { log('ui: ' + e); }
                    },
                },
            });

            Handler.$new(Looper.getMainLooper()).post(Runner.$new());
        });
    } catch (e) {
        uiPending = false;
        log('postUi: ' + e);
    }
}

// The panel is 72% of the screen at most; the rest is bar + actions + padding.
function bodyMax() {
    return Math.max(180, Math.min(Math.round(ui.screenH / ui.density * 0.72), 720) - 148);
}

// Rotation happens inside the same Activity (Flutter declares configChanges), so
// the cached metrics must be re-read, not just when the Activity object changes.
function refreshMetrics(activity) {
    var m = activity.getResources().getDisplayMetrics();
    var w = m.widthPixels.value;
    var h = m.heightPixels.value;
    var d = m.density.value;
    if (w === ui.screenW && h === ui.screenH && d === ui.density) return;

    ui.screenW = w;
    ui.screenH = h;
    ui.density = d;
    if (!ui.web) return;

    ui.width = Math.min(dp(456), ui.screenW - dp(32)) + dp(24);
    ui.left = Math.min(ui.left, Math.max(0, ui.screenW - ui.width));
    ui.top = Math.min(ui.top, Math.max(0, ui.screenH - ui.height));

    // The ResizeObserver in the page re-reports the height after this.
    try {
        ui.web.evaluateJavascript(
            "document.documentElement.style.setProperty('--body-max','" + bodyMax() + "px')", null);
    } catch (e) { log('rotate: ' + e); }

    applyLayout();
}

function uiSync() {
    var activity = currentActivity;
    if (!activity) return;

    if (!ui.activity || !ui.activity.equals(activity)) {
        if (ui.activity) detachAll();
        ui.web = null;
        ui.fab = null;
        ui.loaded = false;
        ui.activity = activity;

        var metrics = activity.getResources().getDisplayMetrics();
        ui.density = metrics.density.value;
        ui.screenW = metrics.widthPixels.value;
        ui.screenH = metrics.heightPixels.value;
    } else {
        refreshMetrics(activity);
    }

    ensureFab(activity);
    if (ui.shown) ensureWeb(activity);
    if (ui.web) {
        if (ui.loaded && reportJson && reportJson !== ui.renderedJson) renderNow();
        ui.web.setVisibility(ui.shown ? 0 : 8);
    }
    if (ui.fab) ui.fab.setVisibility(ui.shown ? 8 : 0);
}

function detachAll() {
    [ui.web, ui.fab].forEach(function (view) {
        if (!view) return;
        try {
            var parent = view.getParent();
            if (parent) parent.removeView(view);
        } catch (e) {}
    });
}

function ensureFab(activity) {
    if (ui.fab) return;

    var TextView = Java.use('android.widget.TextView');
    var Color = Java.use('android.graphics.Color');
    var GradientDrawable = Java.use('android.graphics.drawable.GradientDrawable');
    var Typeface = Java.use('android.graphics.Typeface');
    var Gravity = Java.use('android.view.Gravity');
    var LayoutParams = Java.use('android.widget.FrameLayout$LayoutParams');

    var colors = fabColors();

    var fab = TextView.$new(activity);
    fab.setText(jstr('K12'));
    fab.setTextSize(24);
    fab.setTextColor(Color.parseColor(colors.fg));
    fab.setTypeface(Typeface.DEFAULT_BOLD.value);
    fab.setGravity(Gravity.CENTER.value);
    fab.setIncludeFontPadding(false);

    var bg = GradientDrawable.$new();
    bg.setColor(Color.parseColor(colors.bg));
    bg.setCornerRadius(dp(16));
    fab.setBackground(bg);
    ui.fabBg = Java.retain(bg);
    fab.setElevation(dp(6));
    fab.setClickable(true);

    var Listener = Java.registerClass({
        name: 'k12.port.Fab' + (Date.now() % 100000),
        implements: [Java.use('android.view.View$OnClickListener')],
        methods: {
            onClick: function () {
                ui.shown = true;
                uiSync();
            },
        },
    });
    fab.setOnClickListener(Listener.$new());

    var params = LayoutParams.$new(dp(56), dp(56), Gravity.BOTTOM.value | Gravity.END.value);
    params.setMargins(0, 0, dp(24), dp(24));
    activity.addContentView(fab, params);

    ui.fab = Java.retain(fab);
    log('fab added to ' + activity.getClass().getName());
}

function ensureWeb(activity) {
    if (ui.web) return;

    var WebView = Java.use('android.webkit.WebView');
    var Gravity = Java.use('android.view.Gravity');
    var LayoutParams = Java.use('android.widget.FrameLayout$LayoutParams');

    var web = WebView.$new(activity);
    var settings = web.getSettings();
    settings.setJavaScriptEnabled(true);
    settings.setDomStorageEnabled(false);
    settings.setAllowFileAccess(false);
    settings.setSupportZoom(false);
    settings.setTextZoom(100);
    settings.setLoadWithOverviewMode(false);
    settings.setUseWideViewPort(false);
    try { settings.setForceDark(0); } catch (e) {}

    web.setBackgroundColor(0);
    web.setVerticalScrollBarEnabled(false);
    web.setHorizontalScrollBarEnabled(false);
    web.setOverScrollMode(2);
    web.setWebChromeClient(makeChrome());
    web.setOnTouchListener(makeTouch());

    var body = bodyMax();
    ui.width = Math.min(dp(456), ui.screenW - dp(32)) + dp(24);
    ui.height = dp(body + 148);
    ui.left = Math.max(0, ui.screenW - ui.width - dp(12));
    ui.top = dp(60);

    var params = LayoutParams.$new(ui.width, ui.height, Gravity.TOP.value | Gravity.START.value);
    params.setMargins(ui.left, ui.top, 0, 0);

    web.loadDataWithBaseURL(
        'https://k12.local/',
        pageHtml({
            report: JSON.parse(reportJson || 'null'),
            bodyMax: body,
            theme: savedTheme(),
            hue: savedHue(),
            // Phones get the compact answer key (number + letter) by default.
            compact: ui.screenW / ui.density < 600,
        }),
        'text/html', 'utf-8', null
    );

    activity.addContentView(web, params);
    ui.web = Java.retain(web);
    ui.renderedJson = reportJson;
}

function renderNow() {
    try {
        ui.web.evaluateJavascript('renderReport(JSON.parse(' + JSON.stringify(reportJson) + '))', null);
        ui.renderedJson = reportJson;
    } catch (e) {
        log('render: ' + e);
    }
}

function applyLayout() {
    var LayoutParams = Java.use('android.widget.FrameLayout$LayoutParams');
    var params = LayoutParams.$new(Math.round(ui.width), Math.round(ui.height));
    params.setMargins(Math.round(ui.left), Math.round(ui.top), 0, 0);
    ui.web.setLayoutParams(params);
}

function resizePanel(cssPx) {
    if (!ui.web || !isFinite(cssPx)) return;

    var px = Math.round(cssPx * ui.density);
    if (px < dp(100) || px === ui.height) return;

    ui.height = px;
    if (ui.top + ui.height > ui.screenH) ui.top = Math.max(0, ui.screenH - ui.height);
    applyLayout();
}

function startDrag(x, y) {
    ui.drag = true;
    ui.dragX = x;
    ui.dragY = y;
    ui.startLeft = ui.left;
    ui.startTop = ui.top;
}

function moveDrag(x, y) {
    if (!ui.drag) return;

    var maxLeft = Math.max(0, ui.screenW - ui.width);
    var maxTop = Math.max(0, ui.screenH - ui.height);
    ui.left = Math.min(Math.max(0, ui.startLeft + (x - ui.dragX)), maxLeft);
    ui.top = Math.min(Math.max(0, ui.startTop + (y - ui.dragY)), maxTop);
    applyLayout();
}

// Raw coordinates: the view moves under the finger, view-local ones would feed back.
function makeTouch() {
    var Listener = Java.registerClass({
        name: 'k12.port.Touch' + (Date.now() % 100000),
        implements: [Java.use('android.view.View$OnTouchListener')],
        methods: {
            onTouch: function (view, event) {
                var action = event.getActionMasked();

                if (action === 0) {
                    // Only the title half of the bar drags; the right side is buttons.
                    if (event.getY() < dp(76) && event.getX() < ui.width - dp(120)) {
                        startDrag(event.getRawX(), event.getRawY());
                        return true;
                    }
                    return false;
                }
                if (action === 2 && ui.drag) {
                    moveDrag(event.getRawX(), event.getRawY());
                    return true;
                }
                if ((action === 1 || action === 3) && ui.drag) {
                    ui.drag = false;
                    return true;
                }
                return false;
            },
        },
    });

    return Listener.$new();
}

// The JS side has no addJavascriptInterface (needs @JavascriptInterface), so
// commands arrive through prompt() instead.
function makeChrome() {
    var WebChromeClient = Java.use('android.webkit.WebChromeClient');

    var Chrome = Java.registerClass({
        name: 'k12.port.Chrome' + (Date.now() % 100000),
        superClass: WebChromeClient,
        methods: {
            onJsPrompt: {
                returnType: 'boolean',
                argumentTypes: [
                    'android.webkit.WebView', 'java.lang.String', 'java.lang.String',
                    'java.lang.String', 'android.webkit.JsPromptResult',
                ],
                implementation: function (view, url, message, defaultValue, result) {
                    result.confirm('');
                    try { onPrompt(String(message)); } catch (e) { log('prompt: ' + e); }
                    return true;
                },
            },
            onConsoleMessage: {
                returnType: 'boolean',
                argumentTypes: ['android.webkit.ConsoleMessage'],
                implementation: function (msg) {
                    log('js: ' + msg.message() + ' @' + msg.lineNumber());
                    return true;
                },
            },
        },
    });

    return Chrome.$new();
}

function onPrompt(message) {
    var parts = message.split('|');
    if (parts[0] !== 'k12') return;

    if (parts[1] === 'ready') {
        ui.loaded = true;
        uiSync();
    } else if (parts[1] === 'size') {
        resizePanel(parseFloat(parts[2]));
    } else if (parts[1] === 'close') {
        ui.shown = false;
        uiSync();
    } else if (parts[1] === 'theme') {
        saveUi(parts[2], -1);
        paintFab();
    } else if (parts[1] === 'hue') {
        saveUi(null, parseInt(parts[2], 10));
        paintFab();
    }
}


// Exam screens set FLAG_SECURE, which blacks out screenshots/recording. The flag
// is only ever set through the Window API, so mask it out there.
function hookSecureWindow() {
    var Window = Java.use('android.view.Window');
    var Params = Java.use('android.view.WindowManager$LayoutParams');
    var SECURE = Params.FLAG_SECURE.value;

    Window.setFlags.implementation = function (flags, mask) {
        if (flags & SECURE) log('FLAG_SECURE stripped (setFlags)');
        return this.setFlags(flags & ~SECURE, mask & ~SECURE);
    };

    Window.addFlags.implementation = function (flags) {
        if (flags & SECURE) log('FLAG_SECURE stripped (addFlags)');
        return this.addFlags(flags & ~SECURE);
    };

    Window.setAttributes.implementation = function (attrs) {
        try {
            var flags = attrs.flags.value;
            if (flags & SECURE) {
                log('FLAG_SECURE stripped (setAttributes)');
                attrs.flags.value = flags & ~SECURE;
            }
        } catch (e) {}
        return this.setAttributes(attrs);
    };
}

function hookActivity() {
    var Activity = Java.use('android.app.Activity');
    var PKG = 'vn.viettelstudy.k12';

    Activity.onResume.implementation = function () {
        this.onResume();

        var pkg = '';
        try { pkg = this.getPackageName(); } catch (e) {}
        if (typeof pkg === 'string' && pkg && pkg !== PKG) return;

        // Frida's wrapper holds a local JNI ref that dies with this call.
        currentActivity = Java.retain(this);

        // registerClass() writes a temporary dex; the bridge defaults to
        // /data/local/tmp, which an app process cannot write.
        try {
            var factory = Java.classFactory;
            var cacheDir = this.getCacheDir().getCanonicalPath();
            if (factory.cacheDir !== cacheDir) {
                factory.cacheDir = cacheDir;
                factory.codeCacheDir = this.getCodeCacheDir().getCanonicalPath();
            }
        } catch (e) { log('cacheDir: ' + e); }

        log('resume ' + this.getClass().getName());
        postUi();
    };

    Activity.onConfigurationChanged.implementation = function (config) {
        this.onConfigurationChanged(config);

        var pkg = '';
        try { pkg = this.getPackageName(); } catch (e) {}
        if (typeof pkg === 'string' && pkg && pkg !== PKG) return;

        postUi();
    };
}

/* ------------------------------------------------------------------ */
/* Boot                                                                 */
/* ------------------------------------------------------------------ */

if (typeof Java !== 'undefined') {
    Java.perform(function () {
        log('agent loaded');
        try { hookActivity(); } catch (e) { log('activity: ' + e); }
        try { hookSecureWindow(); } catch (e) { log('secure: ' + e); }
        hookFlutter();
    });

    setInterval(function () {
        if (!pending.length) return;

        var batch = pending;
        pending = [];

        Java.perform(function () {
            for (var i = 0; i < batch.length; i++) {
                try { handleBody(batch[i].headers, batch[i].body); } catch (e) { log('handle: ' + e); }
            }
        });
    }, 500);
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        extractItems: extractItems,
        buildReport: buildReport,
        reportText: reportText,
        describeItem: describeItem,
        extractReport: extractReport,
        streams: streams,
        pending: pending,
        drain: drain,
        utf8: utf8,
    };
}
