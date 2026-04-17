export function ok(data: unknown, statusCode = 200) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({ ok: true, data })
  };
}

export function fail(message: string, statusCode = 500, code = 'ERROR') {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify({ ok: false, error: { code, message } })
  };
}
