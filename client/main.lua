local isEditorOpen = false

-- Toggle Editor Command
RegisterCommand(Config.EditorCommand, function()
    -- Check permissions (Server side check is better, but client side for UI toggle)
    -- We will verify permission on server side before saving/loading
    TriggerServerEvent('rc-interactions:server:checkEditorPermissions')
end, false)

RegisterNetEvent('rc-interactions:client:openEditor', function()
    if isEditorOpen then return end
    isEditorOpen = true
    SetNuiFocus(true, true)
    SendNUIMessage({
        action = 'setVisible',
        data = true
    })
    -- Request initial data
    TriggerServerEvent('rc-interactions:server:loadProjects')
end)

-- NUI Callbacks

RegisterNUICallback('hideFrame', function(_, cb)
    isEditorOpen = false
    SetNuiFocus(false, false)
    SendNUIMessage({
        action = 'setVisible',
        data = false
    })
    cb({ status = 'ok' })
end)
RegisterNUICallback('getPlayerCoords', function(_, cb)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    local heading = GetEntityHeading(ped)

    cb({
        ok = true,
        coords = {
            x = coords.x,
            y = coords.y,
            z = coords.z,
            w = heading,
        },
    })
end)

RegisterNUICallback('saveProject', function(data, cb)
    -- data contains the project object with UUID
    TriggerServerEvent('rc-interactions:server:saveProject', data)
    cb({ status = 'ok' })
end)

RegisterNUICallback('deleteProject', function(data, cb)
    TriggerServerEvent('rc-interactions:server:deleteProject', data.id)
    cb({ status = 'ok' })
end)

-- Receive data from server and pass to UI
RegisterNetEvent('rc-interactions:client:receiveProjects', function(projects)
    SendNUIMessage({
        action = 'loadProjects',
        data = projects
    })
end)

RegisterNetEvent('rc-interactions:client:projectSaved', function(success, msg)
    if success then
        Bridge.Notify('Project saved successfully', 'success')
    else
        Bridge.Notify('Error saving project: ' .. msg, 'error')
    end
end)
