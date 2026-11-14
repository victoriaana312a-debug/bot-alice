const { 
    Client, GatewayIntentBits, Partials, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, StringSelectMenuOptionBuilder 
} = require('discord.js');
const { 
    joinVoiceChannel, createAudioPlayer, createAudioResource,
    entersState, VoiceConnectionStatus, AudioPlayerStatus, getVoiceConnection 
} = require('@discordjs/voice');
const playdl = require('play-dl');

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
const CATEGORIA_TICKETS = '1447402685933334548';
const CHANNEL_LOGS_REGISTROS = '1570976488541528114';
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

        try {
            // Espera a conexão de voz ficar pronta antes de tocar
            await entersState(connection, VoiceConnectionStatus.Ready, 30_000);

            // Se não for link, busca no YouTube pelo nome
            let url = query;
            if (!/^https?:\/\//i.test(query)) {
                const results = await playdl.search(query, { limit: 1, source: { youtube: 'video' } });
                if (!results.length) {
                    connection.destroy();
                    return message.reply('❌ Nenhum resultado encontrado.');
                }
                url = results[0].url;
            }

            const streamData = await playdl.stream(url);
            const resource = createAudioResource(streamData.stream, { inputType: streamData.type });
            const player = createAudioPlayer();

            player.on('error', err => {
                console.error('Erro no player:', err);
                message.channel.send('❌ Erro durante a reprodução.');
            });

            // Desconecta quando a música terminar
            player.on(AudioPlayerStatus.Idle, () => {
                connection.destroy();
            });

            connection.subscribe(player);
            player.play(resource);

            message.reply('🎶 Tocando agora!');
        } catch (error) {
            console.error('Erro detalhado no player:', error);
            connection.destroy();
            message.reply('❌ Ocorreu um erro ao tentar reproduzir esta música.');
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

    // 🎉 PAINEL DE SORTEIOS
    if (message.content.startsWith('!sorteio ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão.');
        }

        const premio = message.content.slice(9);

        const embed = new EmbedBuilder()
            .setTitle('🎉 NOVO SORTEIO!')
            .setDescription(`Prêmio: **${premio}**\n\nClique no botão 🎉 abaixo para garantir a sua participação!`)
            .setColor(0x9B59B6)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_participar_sorteio').setLabel('Participar').setStyle(ButtonStyle.Success).setEmoji('🎉')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
        await message.delete();
    }
});

// ==========================================
// 4. INTERAÇÕES (BOTÕES, MENUS E MODAIS)
// ==========================================
client.on('interactionCreate', async interaction => {
    // Gestão de Tickets por Select Menu
    if (interaction.isStringSelectMenu() && interaction.customId === 'menu_ticket') {
        const tipo = interaction.values[0];
        const guild = interaction.guild;
        const member = interaction.member;
        const nomeCanal = tipo === 'duvida' ? `duvida-${member.user.username}` : `denuncia-${member.user.username}`;

        const channel = await guild.channels.create({
            name: nomeCanal,
            type: ChannelType.GuildText,
            parent: CATEGORIA_TICKETS,
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
        await interaction.reply({ content: `✅ Seu ticket foi aberto em ${channel}!`, ephemeral: true });
    }

    // Fechar Ticket
    if (interaction.isButton() && interaction.customId === 'fechar_ticket') {
        const channel = interaction.channel;
        await interaction.reply('🔒 Fechando o ticket em 5 segundos...');
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
        await interaction.reply({ content: '🎉 Presença garantida! Boa sorte no sorteio!', ephemeral: true });
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

client.login(TOKEN);
