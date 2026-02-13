Bridge = Bridge or {}
Bridge.Framework = Bridge.Framework or nil
Bridge.Ready = Bridge.Ready or false

local function loadBridgeModule(filePath)
    local resourceName = GetCurrentResourceName()
    local code = LoadResourceFile(resourceName, filePath)
    if not code then
        return false, ('LoadResourceFile failed for %s'):format(filePath)
    end

    local chunk, err = load(code, ('@@%s/%s'):format(resourceName, filePath))
    if not chunk then
        return false, err
    end

    local ok, runErr = pcall(chunk)
    if not ok then
        return false, runErr
    end

    return true
end

function Bridge.Initialize()
    local detected = nil
    if Config and Config.Framework and Config.Framework ~= 'auto' then
        detected = Config.Framework
    else
        if GetResourceState('qb-core') == 'started' then
            detected = 'qbcore'
        elseif GetResourceState('es_extended') == 'started' then
            detected = 'esx'
        else
            detected = 'standalone'
        end
    end

    Bridge.Framework = detected

    local moduleFile = 'bridge/standalone.lua'
    if detected == 'qbcore' then
        moduleFile = 'bridge/qb.lua'
    elseif detected == 'esx' then
        moduleFile = 'bridge/esx.lua'
    end

    local ok, err = loadBridgeModule(moduleFile)
    if not ok then
        print(('^1[RC-Interactions]^7 Failed to load %s: %s'):format(moduleFile, err))
        Bridge.Framework = 'standalone'
        loadBridgeModule('bridge/standalone.lua')
    end

    print('^2[RC-Interactions] ^7Framework detected: ^5' .. tostring(Bridge.Framework) .. '^7')

    if Bridge.Framework == 'qbcore' and Bridge.QBCore and Bridge.QBCore.Init then
        Bridge.QBCore.Init()
    elseif Bridge.Framework == 'esx' and Bridge.ESX and Bridge.ESX.Init then
        Bridge.ESX.Init()
    elseif Bridge.Framework == 'standalone' and Bridge.Standalone and Bridge.Standalone.Init then
        Bridge.Standalone.Init()
    end

    Bridge.Ready = true
end

CreateThread(function()
    Bridge.Initialize()
end)

-- Wrapper Functions

local function notifyFallback(msg)
    msg = msg or ''
    if IsDuplicityVersion() then
        -- Server fallback: best-effort chat message
        local src = source
        if src and src ~= 0 then
            TriggerClientEvent('chat:addMessage', src, { args = { 'RC-Interactions', msg } })
        end
        return
    end

    -- Client fallback: GTA feed notification
    BeginTextCommandThefeedPost('STRING')
    AddTextComponentSubstringPlayerName(msg)
    EndTextCommandThefeedPostTicker(false, true)
end

function Bridge.Notify(msg, type, length, source)
    if IsDuplicityVersion() then
        -- Server Side
        if Bridge.Framework == 'qbcore' then
            local QBCore = exports['qb-core']:GetCoreObject()
            QBCore.Functions.Notify(source, msg, type, length)
        elseif Bridge.Framework == 'esx' then
            local xPlayer = Bridge.ESX.GetPlayer(source)
            if xPlayer then xPlayer.showNotification(msg) end
        else
            notifyFallback(msg)
        end
    else
        -- Client Side
        if Bridge.Framework == 'qbcore' and Bridge.QBCore and Bridge.QBCore.Notify then
            Bridge.QBCore.Notify(msg, type, length)
            return
        end

        if Bridge.Framework == 'esx' and Bridge.ESX and Bridge.ESX.Notify then
            Bridge.ESX.Notify(msg, type, length)
            return
        end

        -- If we're not ready yet or no module loaded, fallback safely
        if Bridge.Standalone and Bridge.Standalone.Notify then
            Bridge.Standalone.Notify(msg, type, length)
            return
        end

        notifyFallback(msg)
    end
end

function Bridge.GetIdentifier(source)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.GetIdentifier(source)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.GetIdentifier(source)
    else
        return Bridge.Standalone.GetIdentifier(source)
    end
end

function Bridge.HasGroup(source, group)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.HasGroup(source, group)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.HasGroup(source, group)
    else
        return Bridge.Standalone.HasGroup(source, group)
    end
end

function Bridge.HasItem(source, item, count)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.HasItem(source, item, count)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.HasItem(source, item, count)
    else
        return Bridge.Standalone.HasItem(source, item, count)
    end
end

function Bridge.GetMoney(source, moneyType)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.GetMoney(source, moneyType)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.GetMoney(source, moneyType)
    else
        return Bridge.Standalone.GetMoney(source, moneyType)
    end
end

function Bridge.AddItem(source, item, count)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.AddItem(source, item, count)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.AddItem(source, item, count)
    else
        return Bridge.Standalone.AddItem(source, item, count)
    end
end

function Bridge.RemoveItem(source, item, count)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.RemoveItem(source, item, count)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.RemoveItem(source, item, count)
    else
        return Bridge.Standalone.RemoveItem(source, item, count)
    end
end

function Bridge.AddMoney(source, type, amount)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.AddMoney(source, type, amount)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.AddMoney(source, type, amount)
    else
        return Bridge.Standalone.AddMoney(source, type, amount)
    end
end

function Bridge.RemoveMoney(source, type, amount)
    if Bridge.Framework == 'qbcore' then
        return Bridge.QBCore.RemoveMoney(source, type, amount)
    elseif Bridge.Framework == 'esx' then
        return Bridge.ESX.RemoveMoney(source, type, amount)
    else
        return Bridge.Standalone.RemoveMoney(source, type, amount)
    end
end
