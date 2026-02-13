Bridge = Bridge or {}
Bridge.QBCore = Bridge.QBCore or {}
local QBCore = nil

function Bridge.QBCore.Init()
    QBCore = exports['qb-core']:GetCoreObject()
end

function Bridge.QBCore.Notify(msg, type, length)
    if not QBCore then Bridge.QBCore.Init() end
    if not QBCore then return end
    if IsDuplicityVersion() then
        -- Server
        -- QBCore.Functions.Notify(source, msg, type, length) 
        -- Note: Server notify usually requires source as first arg. 
        -- We will handle this in the wrapper function.
    else
        -- Client
        QBCore.Functions.Notify(msg, type, length)
    end
end

function Bridge.QBCore.GetPlayer(source)
    if not QBCore then Bridge.QBCore.Init() end
    if not QBCore or not QBCore.Functions or not QBCore.Functions.GetPlayer then return nil end
    return QBCore.Functions.GetPlayer(source)
end

function Bridge.QBCore.GetIdentifier(source)
    local Player = Bridge.QBCore.GetPlayer(source)
    if Player then
        return Player.PlayerData.citizenid
    end
    return nil
end

function Bridge.QBCore.HasGroup(source, group)
    if not QBCore then Bridge.QBCore.Init() end
    if not QBCore or not QBCore.Functions then return false end
    if IsDuplicityVersion() then
        return QBCore.Functions.HasPermission(source, group)
    else
        local PlayerData = QBCore.Functions.GetPlayerData()
        if not PlayerData or not PlayerData.job or not PlayerData.gang then return false end
        return PlayerData.job.name == group or PlayerData.gang.name == group
    end
end

function Bridge.QBCore.HasItem(source, item, count)
    if not QBCore then Bridge.QBCore.Init() end
    if not QBCore or not QBCore.Functions then return false end
    if IsDuplicityVersion() then
        local Player = Bridge.QBCore.GetPlayer(source)
        if not Player then return false end
        local itemData = Player.Functions.GetItemByName(item)
        return itemData ~= nil and (itemData.amount or 0) >= (count or 1)
    else
        local PlayerData = QBCore.Functions.GetPlayerData()
        if not PlayerData or not PlayerData.items then return false end
        for _, i in pairs(PlayerData.items) do
            if i.name == item and (i.amount or 0) >= (count or 1) then
                return true
            end
        end
        return false
    end
end

function Bridge.QBCore.AddItem(source, item, count)
    if not IsDuplicityVersion() then return false end
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    return Player.Functions.AddItem(item, count or 1)
end

function Bridge.QBCore.RemoveItem(source, item, count)
    if not IsDuplicityVersion() then return false end
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    return Player.Functions.RemoveItem(item, count or 1)
end

function Bridge.QBCore.GetMoney(source, moneyType)
    if not QBCore then Bridge.QBCore.Init() end
    if not QBCore or not QBCore.Functions then return 0 end
    moneyType = moneyType or 'cash'
    if IsDuplicityVersion() then
        local Player = Bridge.QBCore.GetPlayer(source)
        if not Player then return 0 end
        return Player.PlayerData.money[moneyType] or 0
    else
        local PlayerData = QBCore.Functions.GetPlayerData()
        if not PlayerData or not PlayerData.money then return 0 end
        return PlayerData.money[moneyType] or 0
    end
end

function Bridge.QBCore.AddMoney(source, moneyType, amount)
    if not IsDuplicityVersion() then return false end
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    return Player.Functions.AddMoney(moneyType, amount or 0)
end

function Bridge.QBCore.RemoveMoney(source, moneyType, amount)
    if not IsDuplicityVersion() then return false end
    local Player = QBCore.Functions.GetPlayer(source)
    if not Player then return false end
    return Player.Functions.RemoveMoney(moneyType, amount or 0)
end
