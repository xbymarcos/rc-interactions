Bridge = Bridge or {}
Bridge.Standalone = Bridge.Standalone or {}

function Bridge.Standalone.Init()
    -- No specific initialization needed for standalone
end

function Bridge.Standalone.Notify(msg, type, length)
    if IsDuplicityVersion() then
        -- Server
    else
        -- Client
        BeginTextCommandThefeedPost("STRING")
        AddTextComponentSubstringPlayerName(msg)
        EndTextCommandThefeedPostTicker(false, true)
    end
end

function Bridge.Standalone.GetPlayer(source)
    return nil
end

function Bridge.Standalone.GetIdentifier(source)
    return GetPlayerIdentifier(source, 0)
end

function Bridge.Standalone.HasGroup(source, group)
    if IsDuplicityVersion() then
        -- Server: use ACE permissions
        return IsPlayerAceAllowed(source, group)
    else
        -- Client: use ACE permissions on local player
        return IsPlayerAceAllowed(PlayerId(), group)
    end
end

function Bridge.Standalone.HasItem(source, item, count)
    -- Standalone has no built-in inventory system.
    -- Override this function with your custom inventory check.
    -- Example: return exports['your-inventory']:HasItem(source, item, count)
    print('[RC-Interactions] WARNING: Standalone HasItem is a stub. Override in bridge/standalone.lua for your inventory system.')
    return false
end

function Bridge.Standalone.GetMoney(source, moneyType)
    -- Standalone has no built-in money system.
    -- Override this function with your custom money check.
    -- Example: return exports['your-economy']:GetMoney(source, moneyType)
    print('[RC-Interactions] WARNING: Standalone GetMoney is a stub. Override in bridge/standalone.lua for your economy system.')
    return 0
end

function Bridge.Standalone.AddItem(source, item, count)
    -- Implement custom logic for your inventory system
    print('[RC-Interactions] WARNING: Standalone AddItem is a stub.')
    return false
end

function Bridge.Standalone.RemoveItem(source, item, count)
    -- Implement custom logic for your inventory system
    print('[RC-Interactions] WARNING: Standalone RemoveItem is a stub.')
    return false
end

function Bridge.Standalone.AddMoney(source, type, amount)
    -- Implement custom logic for your economy system
    print('[RC-Interactions] WARNING: Standalone AddMoney is a stub.')
    return false
end

function Bridge.Standalone.RemoveMoney(source, type, amount)
    -- Implement custom logic for your economy system
    print('[RC-Interactions] WARNING: Standalone RemoveMoney is a stub.')
    return false
end
