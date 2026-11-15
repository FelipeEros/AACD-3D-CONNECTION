/**
 * Supabase simulado para testes. Cada consulta é registrada em `calls` e o
 * resultado vem de `handlers`:
 *   handlers.query(q)      -> { data, error }  q = { table, op, filters, ... }
 *   handlers.rpc(name, a)  -> { data, error }
 * Tokens: 'aacd-token' (perfil AACD) e 'inst-token' (instituição INST_ID).
 */
export const AACD_USER = '00000000-0000-4000-8000-00000000aacd';
export const INST_USER = '00000000-0000-4000-8000-0000000000e1';
export const INST_ID = '11111111-1111-4111-8111-111111111111';
export const OTHER_INST_ID = '22222222-2222-4222-8222-222222222222';

const USERS = {
  'aacd-token': { user: { id: AACD_USER, email: 'aacd@aacd.org' }, profile: { id: AACD_USER, perfil: 'aacd', instituicao_id: null } },
  'inst-token': { user: { id: INST_USER, email: 'inst@hosp.org' }, profile: { id: INST_USER, perfil: 'instituicao', instituicao_id: INST_ID } },
};

export function createFakeSupabase(handlers = {}) {
  const calls = [];
  const ok = (data) => ({ data, error: null });

  function builder(table, token) {
    const q = { table, token, op: 'select', filters: [], modifiers: [] };
    const run = () => {
      calls.push(q);
      if (table === 'usuarios' && q.op === 'select' && USERS[token]) {
        const id = q.filters.find((f) => f[0] === 'eq')?.[2];
        const entry = Object.values(USERS).find((u) => u.user.id === id);
        return Promise.resolve(ok(entry?.profile ?? null));
      }
      return Promise.resolve(handlers.query?.(q) ?? ok(q.single ? {} : []));
    };
    const b = {
      select(cols, opts) { if (q.op === 'select') q.columns = cols; q.selectOpts = opts; return b; },
      insert(v) { q.op = 'insert'; q.values = v; return b; },
      update(v) { q.op = 'update'; q.values = v; return b; },
      delete() { q.op = 'delete'; return b; },
      single() { q.single = true; return run(); },
      maybeSingle() { q.single = true; q.maybe = true; return run(); },
      then(res, rej) { return run().then(res, rej); },
    };
    for (const f of ['eq', 'neq', 'in', 'ilike', 'gte', 'lte', 'or', 'is']) {
      b[f] = (...args) => { q.filters.push([f, ...args]); return b; };
    }
    for (const m of ['order', 'range', 'limit']) {
      b[m] = (...args) => { q.modifiers.push([m, ...args]); return b; };
    }
    return b;
  }

  function client(token) {
    return {
      from: (table) => builder(table, token),
      rpc: (name, args) => {
        calls.push({ rpc: name, args, token });
        return Promise.resolve(handlers.rpc?.(name, args, token) ?? ok(null));
      },
      storage: {
        from: (bucket) => ({
          upload: (path, body, opts) => {
            calls.push({ storage: 'upload', bucket, path, size: body?.length, opts, token });
            return Promise.resolve(handlers.upload?.(path) ?? ok({ path }));
          },
          createSignedUrl: (path, expires) => {
            calls.push({ storage: 'signedUrl', bucket, path, expires, token });
            return Promise.resolve(ok({ signedUrl: `https://signed.example/${path}` }));
          },
          remove: (paths) => { calls.push({ storage: 'remove', bucket, paths }); return Promise.resolve(ok([])); },
        }),
      },
      auth: {
        getUser: (t) => Promise.resolve(USERS[t] ? ok({ user: USERS[t].user }) : { data: { user: null }, error: new Error('invalid') }),
        signInWithPassword: ({ email, password }) => {
          const entry = Object.entries(USERS).find(([, u]) => u.user.email === email);
          if (!entry || password !== 'senha-correta') return Promise.resolve({ data: {}, error: new Error('Invalid login') });
          return Promise.resolve(ok({ user: entry[1].user, session: { access_token: entry[0], refresh_token: 'r', expires_at: 1 } }));
        },
        refreshSession: ({ refresh_token }) => Promise.resolve(refresh_token === 'r'
          ? ok({ session: { access_token: 'aacd-token', refresh_token: 'r2', expires_at: 2 } })
          : { data: {}, error: new Error('invalid') }),
        resetPasswordForEmail: (email) => { calls.push({ auth: 'reset', email }); return Promise.resolve(ok({})); },
        admin: {
          updateUserById: (id, attrs) => { calls.push({ auth: 'updateUser', id, attrs }); return Promise.resolve(ok({})); },
          signOut: (jwt) => { calls.push({ auth: 'signOut', jwt }); return Promise.resolve(ok({})); },
          inviteUserByEmail: (email) => {
            calls.push({ auth: 'invite', email });
            return Promise.resolve(handlers.invite?.(email) ?? ok({ user: { id: '33333333-3333-4333-8333-333333333333', email } }));
          },
        },
      },
    };
  }

  return {
    calls,
    forUser: (token) => client(token),
    public: () => client(null),
    admin: () => client('service-role'),
  };
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });
