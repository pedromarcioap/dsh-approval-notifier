/**
 * Metade host do plugin de cliente: este pacote não registra nada no Host.
 * O `main` existe apenas para o carregador resolver o pacote, mas o Loader
 * exige um plugin válido — um módulo vazio falha com "invalid plugin" e
 * derruba toda recarga do perfil. `apply` vazio satisfaz o contrato.
 */
export function apply() {}
