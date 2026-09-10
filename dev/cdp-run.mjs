// Driver mínimo de CDP: abre una URL en Chrome headless y espera a que
// #out termine. Solo para verificación local; no forma parte de la app.
const [, , url] = process.argv
const list = await (await fetch('http://127.0.0.1:9222/json/new?' + encodeURIComponent(url), { method: 'PUT' })).json()
const ws = new WebSocket(list.webSocketDebuggerUrl)
let id = 0
const pending = new Map()
const send = (method, params = {}) =>
  new Promise((res) => { const i = ++id; pending.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
})
await new Promise((r) => ws.addEventListener('open', r))
await send('Runtime.enable')
const logs = []
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.consoleAPICalled') logs.push(m.params.args.map((a) => a.value ?? a.description ?? '').join(' '))
})
const deadline = Date.now() + 90000
let text = ''
while (Date.now() < deadline) {
  const r = await send('Runtime.evaluate', { expression: "document.getElementById('out')?.textContent ?? ''", returnByValue: true })
  text = r.result?.result?.value ?? ''
  if (text.includes('TODO OK') || text.includes('FALLA')) break
  await new Promise((r) => setTimeout(r, 500))
}
console.log(text || '(sin salida)')
if (logs.length) console.log('\n--- consola ---\n' + logs.join('\n'))
process.exit(text.includes('TODO OK') ? 0 : 1)
