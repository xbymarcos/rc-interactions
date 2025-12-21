fx_version 'cerulean'
game 'gta5'
lua54 'yes'

author 'GitHub Copilot'
description 'Modular Interaction System for FiveM'
version '1.0.0'

-- Shared Scripts
shared_scripts {
    'shared/config.lua',
    'bridge/init.lua'
}

-- Server Scripts
server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/*.lua'
}

-- Client Scripts
client_scripts {
    'client/*.lua'
}

-- UI Files
ui_page 'web/dist/index.html'

files {
    'bridge/*.lua',
    'web/dist/index.html',
    'web/dist/assets/*.js',
    'web/dist/assets/*.css'
}
