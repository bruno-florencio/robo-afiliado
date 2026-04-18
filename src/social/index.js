const { loadSocialConfig } = require("./config");

function summarizeBrand(brand) {
  const activeChannels = brand.channels.filter((channel) => channel.enabled);

  return {
    id: brand.id,
    name: brand.name,
    niche: brand.niche,
    activeChannels,
  };
}

function printPlan(brands) {
  if (brands.length === 0) {
    console.log("Nenhuma marca configurada para o agente de conteudo.");
    return;
  }

  console.log("Plano inicial do agente de conteudo:");

  for (const brand of brands) {
    console.log(`- ${brand.name} (${brand.id})`);
    console.log(`  Nicho: ${brand.niche}`);

    if (brand.activeChannels.length === 0) {
      console.log("  Canais ativos: nenhum");
      continue;
    }

    for (const channel of brand.activeChannels) {
      const goal = channel.goal || "sem objetivo definido";
      const cadence = channel.cadence || "sem cadencia definida";
      console.log(
        `  ${channel.network} -> perfil ${channel.profile} | objetivo: ${goal} | cadencia: ${cadence}`
      );
    }
  }
}

function main() {
  const socialConfig = loadSocialConfig();
  const brands = socialConfig.brands.map(summarizeBrand);
  printPlan(brands);
}

main();
