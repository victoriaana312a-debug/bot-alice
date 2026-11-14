const { 
    Client, GatewayIntentBits, Partials, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
    AttachmentBuilder 
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    entersState, VoiceConnectionStatus, AudioPlayerStatus, getVoiceConnection,
    generateDependencyReport, StreamType 
} = require('@discordjs/voice');
const { spawn } = require('child_process');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions, // NECESSÁRIO para o set por reações funcionar
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message, Partials.Reaction, Partials.User]
});

// CONFIGURAÇÕES DO BOT (Token seguro via Railway)
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_AVISOS = '1412972674107310191';
const CHANNEL_LIVES = '1447400943061700759';
const CATEGORIA_TICKETS = '1412972614694998097';
const CHANNEL_LOGS_REGISTROS = '1570976488541528114'; // logs do set/registro
const CHANNEL_LOGS_TICKETS = '1571032220058128394'; // logs de tickets finalizados
const CHANNEL_WELCOME = '1412972674107310191'; // Ajuste o ID se preferir outro canal para entrada/saída

// IDs DE CARGOS DO SET
const CARGOS = {
    menos18: '1412972482608238604',
    mais18: '1412972480338858127',
    homem: '1412972470960656494',
    mulher: '1412972472130732064',
    parceiro: '1412972417046941749',
    membro: '1412972467772850278',
    visitante: '1412972403918901349'
};

client.once('ready', () => {
    console.log(`Bot online como ${client.user.tag}!`);
    console.log(generateDependencyReport()); // mostra o que falta para o áudio funcionar
});

// ==========================================
// 1. BOAS-VINDAS E DESPEDIDAS COM EMBED
// ==========================================
client.on('guildMemberAdd', async member => {
    const channel = member.guild.channels.cache.get(CHANNEL_WELCOME);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('👋 Novo Membro Chegou!')
        .setDescription(`Seja bem-vindo(a) ao servidor, ${member}! Esperamos que se divirta muito por aqui.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setColor(0x2ECC71)
        .setTimestamp()
        .setFooter({ text: `ID do Usuário: ${member.id}` });

    await channel.send({ embeds: [embed] });
});

client.on('guildMemberRemove', async member => {
    const channel = member.guild.channels.cache.get(CHANNEL_WELCOME);
    if (!channel) return;

    const embed = new EmbedBuilder()
        .setTitle('🚪 Membro Saiu')
        .setDescription(`O membro **${member.user.tag}** deixou o servidor.`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
        .setColor(0xE74C3C)
        .setTimestamp();

    await channel.send({ embeds: [embed] });
});

// ==========================================
// 2. MÚSICA NA CALL
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('!play')) {
        const args = message.content.trim().split(/ +/);
        args.shift();
        const query = args.join(' ');

        if (!message.member.voice.channel) {
            return message.reply('❌ Você precisa estar em um canal de voz para tocar música!');
        }

        if (!query) {
            return message.reply('❌ Digite o link ou o nome da música após o comando. Ex: `!play <link ou nome>`');
        }

        const voiceChannel = message.member.voice.channel;
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
            selfDeaf: true
        });

        connection.on('stateChange', (antigo, novo) => console.log(`[voz] ${antigo.status} -> ${novo.status}`));
        connection.on('error', err => console.error('[voz] erro na conexão:', err));

        try {
            // Espera a conexão de voz ficar pronta antes de tocar
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

            // Link vai direto; texto vira busca no YouTube (primeiro resultado)
            const alvo = /^https?:\/\//i.test(query) ? query : `ytsearch1:${query}`;
            console.log('[música] yt-dlp alvo:', alvo);

            const ytArgs = ['-f', 'bestaudio/best', '--no-playlist', '--js-runtimes', 'node', '-q', '--no-warnings', '-o', '-'];
            if (process.env.YTDLP_COOKIES) ytArgs.push('--cookies', process.env.YTDLP_COOKIES); // opcional
            ytArgs.push(alvo);

            const proc = spawn('yt-dlp', ytArgs, { stdio: ['ignore', 'pipe', 'pipe'] });
            let erroTexto = '';
            let recebeuDados = false;
            let avisou = false;
            const avisarErro = texto => {
                if (avisou) return;
                avisou = true;
                connection.destroy();
                message.channel.send(texto).catch(() => {});
            };

            proc.stderr.on('data', d => { erroTexto += d.toString(); });
            proc.stdout.once('data', () => { recebeuDados = true; console.log('[música] áudio começou a chegar'); });
            proc.on('error', err => {
                console.error('[yt-dlp] não iniciou:', err);
                avisarErro('❌ O yt-dlp não está instalado no servidor.');
            });
            proc.on('close', code => {
                if (code !== 0 && !recebeuDados) {
                    console.error('[yt-dlp] falhou:', erroTexto);
                    const ultimaLinha = erroTexto.trim().split('\n').pop().slice(0, 300);
                    avisarErro(`❌ Não consegui obter o áudio: \`${ultimaLinha || 'erro desconhecido'}\``);
                }
            });

            const resource = createAudioResource(proc.stdout, { inputType: StreamType.Arbitrary });
            const player = createAudioPlayer();

            player.on('stateChange', (antigo, novo) => console.log(`[player] ${antigo.status} -> ${novo.status}`));
            player.on('error', err => {
                console.error('Erro no player:', err);
                message.channel.send('❌ Erro durante a reprodução.');
            });

            // Quando terminar, encerra o yt-dlp e sai da call
            player.on(AudioPlayerStatus.Idle, () => {
                proc.kill();
                connection.destroy();
            });

            connection.subscribe(player);
            player.play(resource);

            message.reply('🎶 Buscando e tocando sua música...');
        } catch (error) {
            console.error('Erro detalhado no player:', error);
            connection.destroy();
            message.reply(`❌ Erro ao reproduzir: \`${String(error.message).slice(0, 200)}\``);
        }
    }

    if (message.content === '!leave') {
        const connection = getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('⏹️ Desconectado do canal de voz.');
        } else {
            message.reply('❌ Não estou em nenhum canal de voz.');
        }
    }
});

// ==========================================
// SORTEIOS (estado em memória + funções auxiliares)
// ==========================================
// Obs.: os sorteios ficam na memória do bot. Se o bot reiniciar, sorteios em andamento são perdidos.
const sorteios = new Map(); // idDaMensagem -> { messageId, channelId, guildId, premio, participantes:Set, status, vencedorId }

function embedSorteio(sorteio) {
    const total = sorteio.participantes.size;

    if (sorteio.status === 'pausado') {
        return new EmbedBuilder()
            .setTitle('⏸️ SORTEIO PAUSADO')
            .setDescription(`Prêmio: **${sorteio.premio}**\n\nAs participações estão pausadas no momento. Aguarde a staff retomar!`)
            .setColor(0x95A5A6)
            .setFooter({ text: `Participantes: ${total}` })
            .setTimestamp();
    }

    if (sorteio.status === 'finalizado') {
        const resultado = sorteio.vencedorId
            ? `🏆 Vencedor(a): <@${sorteio.vencedorId}>`
            : 'Nenhum participante neste sorteio.';
        return new EmbedBuilder()
            .setTitle('🏁 SORTEIO FINALIZADO')
            .setDescription(`Prêmio: **${sorteio.premio}**\n\n${resultado}`)
            .setColor(0xE74C3C)
            .setFooter({ text: `Participantes: ${total}` })
            .setTimestamp();
    }

    return new EmbedBuilder()
        .setTitle('🎉 NOVO SORTEIO!')
        .setDescription(`Prêmio: **${sorteio.premio}**\n\nClique no botão 🎉 abaixo para garantir a sua participação!`)
        .setColor(0x9B59B6)
        .setFooter({ text: `Participantes: ${total}` })
        .setTimestamp();
}

function botaoSorteio(sorteio) {
    const ativo = sorteio.status === 'ativo';
    const label = ativo ? 'Participar' : (sorteio.status === 'pausado' ? 'Pausado' : 'Encerrado');
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('btn_participar_sorteio')
            .setLabel(label)
            .setStyle(ativo ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setEmoji('🎉')
            .setDisabled(!ativo)
    );
}

async function atualizarMensagemSorteio(sorteio) {
    const canal = await client.channels.fetch(sorteio.channelId);
    const msg = await canal.messages.fetch(sorteio.messageId);
    await msg.edit({ embeds: [embedSorteio(sorteio)], components: [botaoSorteio(sorteio)] });
}

// Acha o sorteio pelo ID da mensagem; sem ID, pega o mais recente do servidor que atenda ao filtro
function buscarSorteio(guildId, idMensagem, filtro) {
    if (idMensagem) {
        const encontrado = sorteios.get(idMensagem);
        return encontrado && encontrado.guildId === guildId ? encontrado : null;
    }
    const candidatos = [...sorteios.values()].filter(x => x.guildId === guildId && filtro(x));
    return candidatos.length ? candidatos[candidatos.length - 1] : null;
}

// ==========================================
// 3. COMANDOS DE CRIAÇÃO DE PAINÉIS
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    // 🔒 PAINEL DE SET AUTOMÁTICO POR REAÇÕES
    if (message.content.startsWith('!painel-set')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎧 Painel de Registro e Set Automático')
            .setDescription(
                'Reaja abaixo para receber os seus cargos automaticamente:\n\n' +
                '**🔒 Escolha sua faixa etária:**\n' +
                '🍼 `-18`\n' +
                '🔞 `+18`\n\n' +
                '**👥 Escolha como deseja ser reconhecido(a):**\n' +
                '👨 `Homem`\n' +
                '👩 `Mulher`\n\n' +
                '**📌 Profissão / Cargo:**\n' +
                '🤝 `Parceiros`\n' +
                '⭐ `MEMBRO`\n' +
                '🧐 `Visitante`'
            )
            .setColor(0x3498DB);

        const msg = await message.channel.send({ embeds: [embed] });
        
        // Adicionando as reações automaticamente
        await msg.react('🍼');
        await msg.react('🔞');
        await msg.react('👨');
        await msg.react('👩');
        await msg.react('🤝');
        await msg.react('⭐');
        await msg.react('🧐');

        await message.reply('✅ Painel de set por reações enviado com sucesso!');
    }

    // 🎫 PAINEL DE TICKETS COM CATEGORIAS (Dúvidas e Denúncia)
    if (message.content.startsWith('!painel-ticket')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 Central de Atendimento')
            .setDescription('Selecione abaixo o motivo do seu contato para abrir um ticket privado com a staff.')
            .setColor(0x2ECC71);

        const row = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('menu_ticket')
                .setPlaceholder('Selecione o setor de atendimento...')
                .addOptions(
                    new StringSelectMenuOptionBuilder().setLabel('Dúvidas').setDescription('Tire dúvidas gerais com a equipe').setValue('duvida').setEmoji('❓'),
                    new StringSelectMenuOptionBuilder().setLabel('Denúncia').setDescription('Faça uma denúncia sigilosa').setValue('denuncia').setEmoji('🚨')
                )
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.reply('✅ Painel de tickets por categoria enviado!');
    }

    // 💡 PAINEL DE SUGESTÕES
    if (message.content.startsWith('!painel-sugestoes')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const embed = new EmbedBuilder()
            .setTitle('💡 Central de Sugestões')
            .setDescription('Tem alguma ideia para melhorar o servidor? Clique no botão abaixo para enviar a sua sugestão!')
            .setColor(0xF1C40F);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_sugestao').setLabel('Enviar Sugestão').setStyle(ButtonStyle.Primary).setEmoji('💡')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.reply('✅ Painel de sugestões enviado com sucesso!');
    }

    // 🎉 CRIAR SORTEIO: !sorteio <prêmio>
    if (message.content.startsWith('!sorteio ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const premio = message.content.slice(9).trim();
        if (!premio) return message.reply('❌ Informe o prêmio. Ex: `!sorteio Nitro`');

        const sorteio = {
            messageId: null,
            channelId: message.channel.id,
            guildId: message.guild.id,
            premio,
            participantes: new Set(),
            status: 'ativo',
            vencedorId: null
        };

        const enviada = await message.channel.send({
            content: '@everyone',
            embeds: [embedSorteio(sorteio)],
            components: [botaoSorteio(sorteio)]
        });

        sorteio.messageId = enviada.id;
        sorteios.set(enviada.id, sorteio);

        await message.delete().catch(() => {});
    }

    // ⏸️ PAUSAR SORTEIO: !pausar-sorteio [idDaMensagem]
    if (message.content.startsWith('!pausar-sorteio')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const idArg = message.content.split(/ +/)[1];
        const sorteio = buscarSorteio(message.guild.id, idArg, x => x.status === 'ativo');
        if (!sorteio) return message.reply('❌ Não encontrei nenhum sorteio ativo para pausar.');
        if (sorteio.status !== 'ativo') return message.reply('❌ Esse sorteio não está ativo.');

        sorteio.status = 'pausado';
        try {
            await atualizarMensagemSorteio(sorteio);
            message.reply(`⏸️ Sorteio de **${sorteio.premio}** pausado. Use \`!retomar-sorteio\` para continuar.`);
        } catch (error) {
            console.error('Erro ao pausar sorteio:', error);
            message.reply('❌ Não consegui atualizar a mensagem do sorteio (ela ainda existe?).');
        }
    }

    // ▶️ RETOMAR SORTEIO: !retomar-sorteio [idDaMensagem]
    if (message.content.startsWith('!retomar-sorteio')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const idArg = message.content.split(/ +/)[1];
        const sorteio = buscarSorteio(message.guild.id, idArg, x => x.status === 'pausado');
        if (!sorteio) return message.reply('❌ Não encontrei nenhum sorteio pausado para retomar.');
        if (sorteio.status !== 'pausado') return message.reply('❌ Esse sorteio não está pausado.');

        sorteio.status = 'ativo';
        try {
            await atualizarMensagemSorteio(sorteio);
            message.reply(`▶️ Sorteio de **${sorteio.premio}** retomado!`);
        } catch (error) {
            console.error('Erro ao retomar sorteio:', error);
            message.reply('❌ Não consegui atualizar a mensagem do sorteio (ela ainda existe?).');
        }
    }

    // 🏁 FINALIZAR SORTEIO: !finalizar-sorteio [idDaMensagem]
    if (message.content.startsWith('!finalizar-sorteio')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const idArg = message.content.split(/ +/)[1];
        const sorteio = buscarSorteio(message.guild.id, idArg, x => x.status !== 'finalizado');
        if (!sorteio) return message.reply('❌ Não encontrei nenhum sorteio em andamento para finalizar.');
        if (sorteio.status === 'finalizado') return message.reply('❌ Esse sorteio já foi finalizado.');

        const lista = [...sorteio.participantes];
        sorteio.status = 'finalizado';
        sorteio.vencedorId = lista.length ? lista[Math.floor(Math.random() * lista.length)] : null;

        try {
            await atualizarMensagemSorteio(sorteio);
        } catch (error) {
            console.error('Erro ao atualizar mensagem do sorteio:', error);
        }

        if (sorteio.vencedorId) {
            await message.channel.send(`🎉 Parabéns <@${sorteio.vencedorId}>! Você ganhou o sorteio de **${sorteio.premio}**!`);
        } else {
            await message.channel.send(`😕 O sorteio de **${sorteio.premio}** foi finalizado sem participantes.`);
        }
    }
});

// ==========================================
// 4. INTERAÇÕES (BOTÕES, MENUS E MODAIS)
// ==========================================
client.on('interactionCreate', async interaction => {
    // Gestão de Tickets por Select Menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_ticket') {
        // Responde imediatamente (o Discord só espera 3 segundos)
        await interaction.deferReply({ ephemeral: true });

        try {
            const tipo = interaction.values[0];
            const guild = interaction.guild;
            const member = interaction.member;
            const nomeCanal = tipo === 'duvida' ? `duvida-${member.user.username}` : `denuncia-${member.user.username}`;

            const channel = await guild.channels.create({
                name: nomeCanal,
                type: ChannelType.GuildText,
                parent: CATEGORIA_TICKETS,
                topic: `ticket:${tipo}:${member.id}`, // guarda tipo e dono do ticket para o log
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
                    { id: client.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels] }
                ],
            });

            const embed = new EmbedBuilder()
                .setTitle(`Ticket de ${tipo === 'duvida' ? 'Dúvida' : 'Denúncia'} - ${member.user.username}`)
                .setDescription('Descreva detalhadamente o seu caso. A staff responderá em breve.')
                .setColor(tipo === 'duvida' ? 0x3498DB : 0xE74C3C);

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
            );

            await channel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
            await interaction.editReply({ content: `✅ Seu ticket foi aberto em ${channel}!` });
        } catch (error) {
            console.error('Erro ao criar ticket:', error);
            await interaction.editReply({ content: '❌ Não consegui criar o ticket. Avise a staff.' }).catch(() => {});
        }
    }

    // Fechar Ticket (salva o log no canal de logs antes de apagar)
    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        const channel = interaction.channel;
        await interaction.reply('🔒 Salvando o log e fechando o ticket em 5 segundos...');

        try {
            // Busca todas as mensagens do canal (até 1000)
            let todas = [];
            let ultimoId;
            while (todas.length < 1000) {
                const lote = await channel.messages.fetch({ limit: 100, ...(ultimoId && { before: ultimoId }) });
                if (lote.size === 0) break;
                todas.push(...lote.values());
                ultimoId = lote.last().id;
            }
            todas.reverse(); // da mais antiga para a mais nova

            const formatarData = d => d.toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' });

            const linhas = todas.map(m => {
                let texto = m.content || '';
                if (m.embeds.length) texto += ` [embed: ${m.embeds.map(e => e.title || 'sem título').join(', ')}]`;
                if (m.attachments.size) texto += ` [anexos: ${m.attachments.map(a => a.url).join(', ')}]`;
                return `[${formatarData(m.createdAt)}] ${m.author.tag}: ${texto}`;
            });

            const [, tipo, donoId] = (channel.topic || '').split(':');
            const tipoNome = tipo === 'denuncia' ? 'Denúncia' : 'Dúvida';

            const arquivo = new AttachmentBuilder(
                Buffer.from(linhas.join('\n') || 'Sem mensagens.', 'utf-8'),
                { name: `${channel.name}.txt` }
            );

            const embedLog = new EmbedBuilder()
                .setTitle('🎫 Ticket Finalizado')
                .addFields(
                    { name: 'Tipo', value: tipoNome || 'Desconhecido', inline: true },
                    { name: 'Canal', value: channel.name, inline: true },
                    { name: 'Aberto por', value: donoId ? `<@${donoId}>` : 'Desconhecido', inline: false },
                    { name: 'Fechado por', value: `${interaction.user} (${interaction.user.tag})`, inline: false },
                    { name: 'Mensagens', value: String(todas.length), inline: true }
                )
                .setColor(0xE67E22)
                .setTimestamp();

            const logsChannel = interaction.guild.channels.cache.get(CHANNEL_LOGS_TICKETS);
            if (logsChannel) {
                await logsChannel.send({ embeds: [embedLog], files: [arquivo] });
            } else {
                console.error('Canal de logs de tickets não encontrado:', CHANNEL_LOGS_TICKETS);
            }
        } catch (error) {
            console.error('Erro ao salvar log do ticket:', error);
        }

        setTimeout(() => { channel.delete().catch(() => {}); }, 5000);
    }

    // Botão de Sugestão (Abre Modal)
    if (interaction.isButton() && interaction.customId === 'btn_sugestao') {
        const modal = new ModalBuilder()
            .setCustomId('modal_sugestao')
            .setTitle('Enviar Sugestão');

        const input = new TextInputBuilder()
            .setCustomId('texto_sugestao')
            .setLabel('Qual é a sua sugestão?')
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await interaction.showModal(modal);
    }

    // Envio do Modal de Sugestão para o canal
    if (interaction.isModalSubmit() && interaction.customId === 'modal_sugestao') {
        const texto = interaction.fields.getTextInputValue('texto_sugestao');
        
        await interaction.reply({ content: '✅ Sua sugestão foi enviada com sucesso no canal!', ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('💡 Nova Sugestão')
            .setDescription(texto)
            .setAuthor({ name: interaction.user.tag, iconURL: interaction.user.displayAvatarURL() })
            .setColor(0xF1C40F)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('sugestao_aprovar').setLabel('Aprovar').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId('sugestao_reprovar').setLabel('Reprovar').setStyle(ButtonStyle.Danger)
        );

        await interaction.channel.send({ embeds: [embed], components: [row] });
    }

    // Aprovar / Reprovar Sugestão
    if (interaction.isButton() && (interaction.customId === 'sugestao_aprovar' || interaction.customId === 'sugestao_reprovar')) {
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: '❌ Apenas administradores podem votar.', ephemeral: true });
        }

        const embedOriginal = interaction.message.embeds[0];
        const novoEmbed = EmbedBuilder.from(embedOriginal)
            .setColor(interaction.customId === 'sugestao_aprovar' ? 0x2ECC71 : 0xE74C3C)
            .setFooter({ text: `Votado por ${interaction.user.tag}` });

        await interaction.update({ embeds: [novoEmbed], components: [] });
    }

    // Participar de Sorteio
    if (interaction.isButton() && interaction.customId === 'btn_participar_sorteio') {
        const sorteio = sorteios.get(interaction.message.id);

        if (!sorteio) {
            return interaction.reply({ content: '❌ Este sorteio não está mais ativo (o bot foi reiniciado). Peça para a staff criar outro.', ephemeral: true });
        }
        if (sorteio.status === 'pausado') {
            return interaction.reply({ content: '⏸️ Este sorteio está pausado no momento.', ephemeral: true });
        }
        if (sorteio.status === 'finalizado') {
            return interaction.reply({ content: '🏁 Este sorteio já foi finalizado.', ephemeral: true });
        }
        if (sorteio.participantes.has(interaction.user.id)) {
            return interaction.reply({ content: '✅ Você já está participando deste sorteio!', ephemeral: true });
        }

        sorteio.participantes.add(interaction.user.id);
        await interaction.reply({ content: '🎉 Presença garantida! Boa sorte no sorteio!', ephemeral: true });
        interaction.message.edit({ embeds: [embedSorteio(sorteio)] }).catch(() => {}); // atualiza o contador
    }
});

// ==========================================
// 5. SISTEMA DE SET AUTOMÁTICO POR REAÇÕES E LOGS
// ==========================================
client.on('messageReactionAdd', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});

    const guild = reaction.message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    let cargoId = null;
    let nomeCargoLog = '';

    switch (reaction.emoji.name) {
        case '🍼': cargoId = CARGOS.menos18; nomeCargoLog = '-18'; break;
        case '🔞': cargoId = CARGOS.mais18; nomeCargoLog = '+18'; break;
        case '👨': cargoId = CARGOS.homem; nomeCargoLog = 'Homem'; break;
        case '👩': cargoId = CARGOS.mulher; nomeCargoLog = 'Mulher'; break;
        case '🤝': cargoId = CARGOS.parceiro; nomeCargoLog = 'Parceiro'; break;
        case '⭐': cargoId = CARGOS.membro; nomeCargoLog = 'Membro'; break;
        case '🧐': cargoId = CARGOS.visitante; nomeCargoLog = 'Visitante'; break;
    }

    if (cargoId) {
        await member.roles.add(cargoId).catch(() => {});

        // Enviar para o canal de logs
        const logsChannel = guild.channels.cache.get(CHANNEL_LOGS_REGISTROS);
        if (logsChannel) {
            const embedLog = new EmbedBuilder()
                .setTitle('🎧 Set Atribuído Automaticamente')
                .addFields(
                    { name: 'Membro', value: `${member} (${member.user.tag})`, inline: false },
                    { name: 'Cargo Recebido', value: nomeCargoLog, inline: true }
                )
                .setColor(0x3498DB)
                .setTimestamp();
            await logsChannel.send({ embeds: [embedLog] });
        }
    }
});

client.on('messageReactionRemove', async (reaction, user) => {
    if (user.bot) return;
    if (reaction.partial) await reaction.fetch().catch(() => {});

    const guild = reaction.message.guild;
    if (!guild) return;
    const member = await guild.members.fetch(user.id).catch(() => null);
    if (!member) return;

    let cargoId = null;
    switch (reaction.emoji.name) {
        case '🍼': cargoId = CARGOS.menos18; break;
        case '🔞': cargoId = CARGOS.mais18; break;
        case '👨': cargoId = CARGOS.homem; break;
        case '👩': cargoId = CARGOS.mulher; break;
        case '🤝': cargoId = CARGOS.parceiro; break;
        case '⭐': cargoId = CARGOS.membro; break;
        case '🧐': cargoId = CARGOS.visitante; break;
    }

    if (cargoId) {
        await member.roles.remove(cargoId).catch(() => {});
    }
});

// ==========================================
// 6. AVISOS E LIVES
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot || !message.guild) return;

    if (message.content.startsWith('!aviso ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const texto = message.content.slice(7);
        const canal = message.guild.channels.cache.get(CHANNEL_AVISOS) || message.channel;

        const embed = new EmbedBuilder()
            .setTitle('🚨 AVISO IMPORTANTE')
            .setDescription(texto)
            .setColor(0xFF0000)
            .setTimestamp();

        await canal.send({ content: '@everyone', embeds: [embed] });
    }

    if (message.content.startsWith('!live ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const args = message.content.slice(6).split(' | ');
        const link = args[0];
        const titulo = args[1] || 'Live aberta!';
        const canal = message.guild.channels.cache.get(CHANNEL_LIVES) || message.channel;

        const embed = new EmbedBuilder()
            .setTitle('🔴 ESTOU AO VIVO!')
            .setDescription(`**${titulo}**\n\nClique no botão abaixo para assistir!`)
            .setColor(0x9146FF);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setURL(link).setLabel('Assistir Live').setStyle(ButtonStyle.Link)
        );

        await canal.send({ content: '@everyone 🔴 **LIVE ON!**', embeds: [embed], components: [row] });
    }
});

process.on('unhandledRejection', err => console.error('Erro não tratado:', err));
process.on('uncaughtException', err => console.error('Exceção não tratada:', err));

client.login(TOKEN);
