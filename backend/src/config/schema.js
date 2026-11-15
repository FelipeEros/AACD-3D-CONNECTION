/**
 * NOMES DO BANCO USADOS PELO BACKEND — CONFERIR COM O SUPABASE REAL.
 *
 * O guia de integração lista tabelas, views, RPCs e status, mas não traz
 * todas as colunas nem os nomes dos argumentos das funções. Tudo o que o
 * Backend supõe sobre o schema está concentrado AQUI, para que a equipe de
 * banco ajuste num único lugar. Itens marcados com "CONFERIR" são suposições.
 *
 * Para conferir colunas (SQL Editor do Supabase):
 *   select table_name, column_name, data_type from information_schema.columns
 *   where table_schema = 'public' order by table_name, ordinal_position;
 * Para conferir argumentos das RPCs:
 *   select p.proname, pg_get_function_arguments(p.oid) from pg_proc p
 *   join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public';
 */

export const TABLES = Object.freeze({
  usuarios: 'usuarios',
  instituicoes: 'instituicoes',
  impressoras: 'impressoras',
  impressoraMateriais: 'impressora_materiais',
  materiais: 'materiais',
  estoqueMovimentacoes: 'estoque_movimentacoes',
  solicitacoes: 'solicitacoes',
  itensSolicitacao: 'itens_solicitacao',
  mensagens: 'mensagens',
  arquivos: 'arquivos',
});

export const VIEWS = Object.freeze({
  saldoEstoque: 'vw_saldo_estoque',
  alertasEstoque: 'vw_alertas_estoque',
});

export const BUCKET = 'arquivos';

// Colunas usadas em filtros, vínculos e ordenação.
export const COLUMNS = Object.freeze({
  // CONFERIR: coluna de usuarios que guarda o id do auth.users
  usuarioAuthId: 'id',
  // CONFERIR: coluna de perfil do usuário e seus valores
  usuarioPerfil: 'perfil',
  instituicaoId: 'instituicao_id', // CONFERIR: FK usada nas tabelas de recursos
  impressoraId: 'impressora_id',
  materialId: 'material_id',
  solicitacaoId: 'solicitacao_id',
  mensagemId: 'mensagem_id',
  status: 'status',
  remetenteId: 'remetente_id', // CONFERIR: autor da mensagem
  caminhoStorage: 'caminho_storage', // citado no guia
  criadoEm: 'created_at', // CONFERIR: pode ser criado_em
  estado: 'estado', // CONFERIR: filtros da tela de instituições
  cidade: 'cidade',
  nome: 'nome',
  instituicaoEmail: 'email', // CONFERIR: e-mail de contato usado para criar o acesso
});

// Campos editáveis pela API, por tabela. A API usa os MESMOS nomes das
// colunas. CONFERIR todos (derivados dos formulários do Frontend).
export const FIELDS = Object.freeze({
  impressoras: ['nome', 'fabricante', 'modelo', 'numero_serie', 'tecnologia', 'observacoes'],
  materiais: ['nome', 'tipo', 'marca', 'lote', 'cor', 'unidade'],
  solicitacoes: ['instituicao_id', 'impressora_id', 'prazo', 'observacoes', 'arquivo_modelo'],
  itensSolicitacao: ['solicitacao_id', 'material_id', 'quantidade', 'observacoes'],
});

// CONFERIR: valores de usuarios.perfil
export const PERFIS = Object.freeze({ aacd: 'aacd', instituicao: 'instituicao' });

// Valores confirmados pelo guia.
export const STATUS_SOLICITACAO = Object.freeze([
  'pendente', 'aceita', 'em_producao', 'concluida', 'recusada', 'cancelada',
]);
export const STATUS_IMPRESSORA = Object.freeze(['disponivel', 'ocupada', 'indisponivel']);

// RPCs do guia. Os NOMES das funções estão confirmados; os nomes dos
// ARGUMENTOS seguem o padrão p_* do exemplo do guia (CONFERIR os demais).
export const RPC = Object.freeze({
  solicitarCadastroInstituicao: {
    name: 'solicitar_cadastro_instituicao',
    // CONFERIR ordem/nomes dos 5 argumentos text
    args: (d) => ({
      p_nome: d.nome,
      p_cnpj: d.cnpj,
      p_email: d.email,
      p_telefone: d.telefone,
      p_endereco: d.endereco,
    }),
  },
  vincularUsuarioInstituicao: {
    name: 'vincular_usuario_instituicao',
    args: ({ usuarioId, instituicaoId }) => ({ p_usuario_id: usuarioId, p_instituicao_id: instituicaoId }),
  },
  aprovarInstituicao: { name: 'aprovar_instituicao', args: ({ id }) => ({ p_instituicao_id: id }) },
  rejeitarInstituicao: { name: 'rejeitar_instituicao', args: ({ id }) => ({ p_instituicao_id: id }) },
  desativarInstituicao: { name: 'desativar_instituicao', args: ({ id }) => ({ p_instituicao_id: id }) },
  alterarDisponibilidadeImpressora: {
    name: 'alterar_disponibilidade_impressora',
    args: ({ id, status }) => ({ p_impressora_id: id, p_status: status }),
  },
  atualizarStatusSolicitacao: {
    name: 'atualizar_status_solicitacao',
    args: ({ id, status }) => ({ p_solicitacao_id: id, p_status: status }),
  },
  cancelarSolicitacao: { name: 'cancelar_solicitacao', args: ({ id }) => ({ p_solicitacao_id: id }) },
  concluirProducao: {
    name: 'concluir_producao',
    // CONFERIR o formato do jsonb esperado pela função.
    args: ({ id, consumo }) => ({
      p_solicitacao_id: id,
      p_consumo: consumo.map((c) => ({ item_id: c.item_id, quantidade_consumida: c.quantidade_consumida })),
    }),
  },
  registrarMovimentacaoEstoque: {
    name: 'registrar_movimentacao_estoque',
    args: ({ materialId, tipo, quantidade, observacao }) => ({
      p_material_id: materialId,
      p_tipo: tipo,
      p_quantidade: quantidade,
      p_observacao: observacao ?? null,
    }),
  },
  definirEstoqueMinimo: {
    name: 'definir_estoque_minimo',
    args: ({ materialId, minimo }) => ({ p_material_id: materialId, p_estoque_minimo: minimo }),
  },
});

/** Executa uma RPC declarada acima e devolve os dados (lança erro do Supabase). */
export async function callRpc(client, rpc, params) {
  const { data, error } = await client.rpc(rpc.name, rpc.args(params));
  if (error) throw error;
  return data;
}
