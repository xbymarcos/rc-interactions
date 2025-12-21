Bridge = Bridge or {}
Bridge.ESX = Bridge.ESX or {}
local ESX = nil

function Bridge.ESX.Init()
    if IsDuplicityVersion() then
        ESX = exports["es_extended"]:getSharedObject()
    else
        ESX = exports["es_extended"]:getSharedObject()
    end
end

function Bridge.ESX.Notify(msg, type, length)
    if not ESX then return end
    if IsDuplicityVersion() then
        -- Server logic would go here if needed, usually triggered via client event
    else
        ESX.ShowNotification(msg)
    end
end

function Bridge.ESX.GetPlayer(source)
    if IsDuplicityVersion() then
        return ESX.GetPlayerFromId(source)
    end
    return nil
end

function Bridge.ESX.GetIdentifier(source)
    local xPlayer = Bridge.ESX.GetPlayer(source)
    if xPlayer then
        return xPlayer.identifier
    end
    return nil
end

function Bridge.ESX.HasGroup(source, group)
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            return xPlayer.getGroup() == group
        end
    end
    return false
end

function Bridge.ESX.AddItem(source, item, count)
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            xPlayer.addInventoryItem(item, count)
            return true
        end
    end
    return false
end

function Bridge.ESX.RemoveItem(source, item, count)
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            xPlayer.removeInventoryItem(item, count)
            return true
        end
    end
    return false
end

function Bridge.ESX.AddMoney(source, type, amount)
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            if type == 'cash' then
                xPlayer.addMoney(amount)
            elseif type == 'bank' then
                xPlayer.addAccountMoney('bank', amount)
            end
            return true
        end
    end
    return false
end

function Bridge.ESX.RemoveMoney(source, type, amount)
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            if type == 'cash' then
                xPlayer.removeMoney(amount)
            elseif type == 'bank' then
                xPlayer.removeAccountMoney('bank', amount)
            end
            return true
        end
    end
    return false
end
