const { 
    Client, GatewayIntentBits, Partials, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle, 
    EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, 
    ChannelType, PermissionFlagsBits 
} = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource } = require('@discordjs/voice');
const playdl = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ],
    partials: [Partials.Channel, Partials.Message]
});

// CONFIGURAÇÕES DO BOT (Lendo o token com segurança pelo Railway)
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_AVISOS = '1412972674107310191';
const CHANNEL_LIVES = '1447400943061700759';
const CATEGORIA_TICKETS = '1447402685933334548';
const CHANNEL_LOGS_REGISTROS = '1570976488541528114';

client.once('ready', () => {
    console.log(`Bot online como ${client.user.tag}!`);
});

// ==========================================
// 1. MÚSICA NA CALL
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!play')) {
        const args = message.content.trim().split(/ +/);
        args.shift();
        const query = args.join(' ');

        if (!message.member.voice.channel) {
            return message.reply('❌ Você precisa estar em um canal de voz para tocar música!');
        }

        if (!query) {
            return message.reply('❌ Digite o link ou o nome da música após o comando. Ex: `!play <link>`');
        }

        const voiceChannel = message.member.voice.channel;
        const connection = joinVoiceChannel({
            channelId: voiceChannel.id,
            guildId: voiceChannel.guild.id,
            adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        });

        try {
            let streamData = await playdl.stream(query);
            const resource = createAudioResource(streamData.stream, { inputType: streamData.type });
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            message.reply(`🎶 Tocando agora!`);
        } catch (error) {
            console.error('Erro detalhado no player:', error);
            message.reply('❌ Ocorreu um erro ao tentar reproduzir esta música.');
        }
    }

    if (message.content === '!leave') {
        const connection = require('@discordjs/voice').getVoiceConnection(message.guild.id);
        if (connection) {
            connection.destroy();
            message.reply('⏹️ Desconectado do canal de voz.');
        } else {
            message.reply('❌ Não estou em nenhum canal de voz.');
        }
    }
});

// ==========================================
// 2. PAINEL DE REGISTROS GERAL & PAINEL DE PEDIR SET SEPARADO
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!painel-registros')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão para usar este comando.');
        }

        const targetChannel = message.mentions.channels.first() || message.channel;

        const embed = new EmbedBuilder()
            .setTitle('📋 Painel de Registros')
            .setDescription('Clique no botão abaixo para registrar sua ausência.')
            .setColor(0x00AE86);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_ausencia').setLabel('Registrar Ausência').setStyle(ButtonStyle.Danger)
        );

        await targetChannel.send({ embeds: [embed], components: [row] });
        if (targetChannel.id !== message.channel.id) {
            await message.reply(`✅ Painel de registros enviado com sucesso em ${targetChannel}!`);
        }
    }

    if (message.content.startsWith('!painel-set')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão para usar este comando.');
        }

        const targetChannel = message.mentions.channels.first() || message.channel;

        const embedSet = new EmbedBuilder()
            .setTitle('🎧 Painel de Pedido de Set')
            .setDescription('Deseja pedir o seu set? Clique no botão abaixo para preencher o formulário oficial.')
            .setColor(0x3498DB);

        const rowSet = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('btn_pedir_set').setLabel('Pedir Set').setStyle(ButtonStyle.Primary).setEmoji('🎧')
        );

        await targetChannel.send({ embeds: [embedSet], components: [rowSet] });
        if (targetChannel.id !== message.channel.id) {
            await message.reply(`✅ Painel de Pedir Set enviado com sucesso em ${targetChannel}!`);
        }
    }
});

client.on('interactionCreate', async interaction => {
    if (interaction.isButton()) {
        if (interaction.customId === 'btn_pedir_set') {
            const modal = new ModalBuilder()
                .setCustomId('modal_pedir_set')
                .setTitle('Formulário de Pedido de Set');

            const inputNome = new TextInputBuilder()
                .setCustomId('input_nome')
                .setLabel('1. Qual o seu Nome?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inputIdade = new TextInputBuilder()
                .setCustomId('input_idade')
                .setLabel('2. Idade (+18 ou -18)?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inputGenero = new TextInputBuilder()
                .setCustomId('input_genero')
                .setLabel('3. Homem ou Mulher?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            const inputTipo = new TextInputBuilder()
                .setCustomId('input_tipo')
                .setLabel('4. Parceiro ou Membro?')
                .setStyle(TextInputStyle.Short)
                .setRequired(true);

            modal.addComponents(
                new ActionRowBuilder().addComponents(inputNome),
                new ActionRowBuilder().addComponents(inputIdade),
                new ActionRowBuilder().addComponents(inputGenero),
                new ActionRowBuilder().addComponents(inputTipo)
            );

            await interaction.showModal(modal);
        }

        if (interaction.customId === 'btn_ausencia') {
            const modal = new ModalBuilder()
                .setCustomId('modal_ausencia')
                .setTitle('Registro de Ausência');

            const inputMotivo = new TextInputBuilder()
                .setCustomId('input_motivo_ausencia')
                .setLabel('Motivo e período da ausência')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true);

            modal.addComponents(new ActionRowBuilder().addComponents(inputMotivo));
            await interaction.showModal(modal);
        }
    }

    if (interaction.isModalSubmit()) {
        const logsChannel = interaction.guild.channels.cache.get(CHANNEL_LOGS_REGISTROS);

        if (interaction.customId === 'modal_pedir_set') {
            const nome = interaction.fields.getTextInputValue('input_nome');
            const idade = interaction.fields.getTextInputValue('input_idade');
            const genero = interaction.fields.getTextInputValue('input_genero');
            const tipo = interaction.fields.getTextInputValue('input_tipo');
            
            await interaction.reply({ content: `✅ Seu formulário de pedido de set foi enviado com sucesso para a staff!`, ephemeral: true });

            if (logsChannel) {
                const embedLogSet = new EmbedBuilder()
                    .setTitle('🎧 Novo Pedido de Set Preenchido')
                    .addFields(
                        { name: 'Discord User', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
                        { name: '1. Nome', value: nome, inline: true },
                        { name: '2. Idade', value: idade, inline: true },
                        { name: '3. Homem/Mulher', value: genero, inline: true },
                        { name: '4. Parceiro/Membro', value: tipo, inline: true }
                    )
                    .setColor(0x3498DB)
                    .setTimestamp();
                await logsChannel.send({ embeds: [embedLogSet] });
            }
        }

        if (interaction.customId === 'modal_ausencia') {
            const motivo = interaction.fields.getTextInputValue('input_motivo_ausencia');
            
            await interaction.reply({ content: `✅ Ausência registrada com sucesso para a staff!`, ephemeral: true });

            if (logsChannel) {
                const embedLogAusencia = new EmbedBuilder()
                    .setTitle('⚠️ Novo Registro de Ausência')
                    .addFields(
                        { name: 'Membro', value: `<@${interaction.user.id}> (${interaction.user.tag})`, inline: false },
                        { name: 'Motivo / Período', value: motivo, inline: false }
                    )
                    .setColor(0xE74C3C)
                    .setTimestamp();
                await logsChannel.send({ embeds: [embedLogAusencia] });
            }
        }
    }
});

// ==========================================
// 3 & 4. MANDAR AVISOS E NOTIFICAR LIVE
// ==========================================
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content.startsWith('!aviso ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão para usar este comando.');
        }
        const avisoTexto = message.content.slice(7);
        const canalAvisos = message.guild.channels.cache.get(CHANNEL_AVISOS) || message.channel;

        const embedAviso = new EmbedBuilder()
            .setTitle('🚨 AVISO IMPORTANTE')
            .setDescription(avisoTexto)
            .setColor(0xFF0000)
            .setTimestamp()
            .setFooter({ text: `Enviado por ${message.author.tag}` });

        await canalAvisos.send({ content: '@everyone', embeds: [embedAviso] });
        await message.reply('✅ Aviso enviado com sucesso!');
    }

    if (message.content.startsWith('!live ')) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return message.reply('❌ Você não tem permissão para usar este comando.');
        }
        const args = message.content.slice(6).split(' | ');
        const linkLive = args[0];
        const tituloLive = args[1] || 'Live aberta!';
        const canalLives = message.guild.channels.cache.get(CHANNEL_LIVES) || message.channel;

        const embedLive = new EmbedBuilder()
            .setTitle('🔴 ESTOU AO VIVO!')
            .setDescription(`**${tituloLive}**\n\nVenha acompanhar agora mesmo clicando no botão abaixo!`)
            .setColor(0x9146FF)
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setURL(linkLive).setLabel('Assistir Live').setStyle(ButtonStyle.Link)
        );

        await canalLives.send({ content: '@everyone 🔴 **LIVE ON!**', embeds: [embedLive], components: [row] });
        await message.reply('✅ Notificação de live enviada com sucesso!');
    }
});

// ==========================================
// 5. TICKET COM CATEGORIA
// ==========================================
client.on('messageCreate', async message => {
    if (message.content === '!painel-ticket') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 Central de Atendimento')
            .setDescription('Precisa de ajuda? Clique no botão abaixo para abrir um ticket.')
            .setColor(0x3498DB);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('abrir_ticket').setLabel('Abrir Ticket').setStyle(ButtonStyle.Success).setEmoji('🎫')
        );

        await message.channel.send({ embeds: [embed], components: [row] });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isButton()) return;

    if (interaction.customId === 'abrir_ticket') {
        const guild = interaction.guild;
        const member = interaction.member;

        const channel = await guild.channels.create({
            name: `ticket-${member.user.username}`,
            type: ChannelType.GuildText,
            parent: CATEGORIA_TICKETS,
            permissionOverwrites: [
                {
                    id: guild.id,
                    deny: [PermissionFlagsBits.ViewChannel],
                },
                {
                    id: member.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory],
                },
                {
                    id: client.user.id,
                    allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageChannels],
                }
            ],
        });

        const embed = new EmbedBuilder()
            .setTitle(`Ticket de ${member.user.username}`)
            .setDescription('Descreva seu problema/dúvida detalhadamente. A equipe responderá em breve.')
            .setColor(0x2ECC71);

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('fechar_ticket').setLabel('Fechar Ticket').setStyle(ButtonStyle.Danger)
        );

        await channel.send({ content: `<@${member.id}>`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ Seu ticket foi criado em ${channel}!`, ephemeral: true });
    }

    if (interaction.customId === 'fechar_ticket') {
        const channel = interaction.channel;
        await interaction.reply('🔒 Fechando o ticket em 5 segundos...');
        setTimeout(() => {
            channel.delete().catch(() => {});
        }, 5000);
    }
});

client.login(TOKEN);