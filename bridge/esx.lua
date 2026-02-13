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
            -- Check admin group first
            if xPlayer.getGroup() == group then return true end
            -- Check job name
            if xPlayer.getJob() and xPlayer.getJob().name == group then return true end
        end
    else
        -- Client side: check local player job
        local playerData = ESX.GetPlayerData()
        if playerData and playerData.job and playerData.job.name == group then
            return true
        end
    end
    return false
end

function Bridge.ESX.HasItem(source, item, count)
    count = count or 1
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            local itemData = xPlayer.getInventoryItem(item)
            return itemData ~= nil and (itemData.count or 0) >= count
        end
    else
        -- Client side: check local player inventory
        local playerData = ESX.GetPlayerData()
        if playerData and playerData.inventory then
            for _, v in ipairs(playerData.inventory) do
                if v.name == item then
                    return (v.count or 0) >= count
                end
            end
        end
    end
    return false
end

function Bridge.ESX.GetMoney(source, moneyType)
    moneyType = moneyType or 'cash'
    if IsDuplicityVersion() then
        local xPlayer = Bridge.ESX.GetPlayer(source)
        if xPlayer then
            if moneyType == 'cash' then
                return xPlayer.getMoney()
            else
                return xPlayer.getAccount(moneyType) and xPlayer.getAccount(moneyType).money or 0
            end
        end
    else
        local playerData = ESX.GetPlayerData()
        if playerData then
            if moneyType == 'cash' then
                return playerData.money or 0
            elseif playerData.accounts then
                for _, account in ipairs(playerData.accounts) do
                    if account.name == moneyType then
                        return account.money or 0
                    end
                end
            end
        end
    end
    return 0
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
