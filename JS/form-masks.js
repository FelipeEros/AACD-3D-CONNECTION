(function () {
  function digits(value) {
    return value.replace(/\D/g, '');
  }

  function cnpj(value) {
    return digits(value).slice(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }

  function telefone(value) {
    const valueDigits = digits(value).slice(0, 11);
    if (valueDigits.length <= 10) {
      return valueDigits.replace(/^(\d{2})(\d)/, '($1) $2').replace(/(\d{4})(\d)/, '$1-$2');
    }
    return valueDigits.replace(/^(\d{2})(\d{5})(\d)/, '($1) $2-$3');
  }

  function bind(input, formatter) {
    if (!input || input.dataset.maskBound === 'true') return;
    input.dataset.maskBound = 'true';
    const apply = () => { input.value = formatter(input.value); };
    input.addEventListener('input', apply);
    input.addEventListener('change', apply);
    input.addEventListener('blur', apply);
    apply();
  }

  function bindMasks() {
    bind(document.querySelector('[data-mask="cnpj"]'), cnpj);
    bind(document.querySelector('[data-mask="telefone"]'), telefone);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bindMasks);
  } else {
    bindMasks();
  }
}());
