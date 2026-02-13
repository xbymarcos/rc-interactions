--[[
    RC-Interactions — Version Checker
    ==================================
    Checks GitHub releases API on resource start for new versions.
    Can be disabled via Config.CheckForUpdates = false.

    Prints update info + release notes to the server console.
]]

local REPO_OWNER  = 'xbymarcos'
local REPO_NAME   = 'rc-interactions'
local API_URL     = ('https://api.github.com/repos/%s/%s/releases/latest'):format(REPO_OWNER, REPO_NAME)
local RELEASE_URL = ('https://github.com/%s/%s/releases/latest'):format(REPO_OWNER, REPO_NAME)

--- Parse a semver string "v1.2.3" or "1.2.3" into {major, minor, patch}.
--- Returns nil on invalid input.
local function ParseVersion(str)
    if not str then return nil end
    local major, minor, patch = str:match('^v?(%d+)%.(%d+)%.(%d+)')
    if not major then return nil end
    return {
        major = tonumber(major),
        minor = tonumber(minor),
        patch = tonumber(patch),
    }
end

--- Compare two parsed versions. Returns:
---   1  if a > b
---   0  if a == b
---  -1  if a < b
local function CompareVersions(a, b)
    if a.major ~= b.major then return a.major > b.major and 1 or -1 end
    if a.minor ~= b.minor then return a.minor > b.minor and 1 or -1 end
    if a.patch ~= b.patch then return a.patch > b.patch and 1 or -1 end
    return 0
end

--- Clean markdown body for console output.
--- Converts **bold** to text, removes #, trims lines.
local function FormatReleaseNotes(body)
    if not body then return '  No release notes available.' end

    local lines = {}
    for line in body:gmatch('[^\r\n]+') do
        -- Strip markdown bold
        line = line:gsub('%*%*(.-)%*%*', '%1')
        -- Convert ### headers
        line = line:gsub('^###%s*', '  >> ')
        -- Convert ## headers
        line = line:gsub('^##%s*', '  >> ')
        -- Convert # headers
        line = line:gsub('^#%s*', '  ')
        -- Convert - list items
        line = line:gsub('^%s*%-%s', '    • ')
        -- Trim trailing whitespace
        line = line:gsub('%s+$', '')

        if line ~= '' then
            table.insert(lines, '  ' .. line)
        end
    end

    return table.concat(lines, '\n')
end

local function CheckForUpdates()
    local currentVersion = GetResourceMetadata(GetCurrentResourceName(), 'version', 0)
    if not currentVersion then
        print('^1[RC-Interactions]^7 Could not read current version from fxmanifest.lua')
        return
    end

    local current = ParseVersion(currentVersion)
    if not current then
        print('^1[RC-Interactions]^7 Invalid version format in fxmanifest: ' .. tostring(currentVersion))
        return
    end

    PerformHttpRequest(API_URL, function(statusCode, responseBody, headers)
        if statusCode ~= 200 then
            if Config.Debug then
                print('^3[RC-Interactions]^7 Version check failed (HTTP ' .. tostring(statusCode) .. ')')
            end
            return
        end

        local data = json.decode(responseBody)
        if not data or not data.tag_name then
            if Config.Debug then
                print('^3[RC-Interactions]^7 Version check: invalid API response')
            end
            return
        end

        local latest = ParseVersion(data.tag_name)
        if not latest then
            if Config.Debug then
                print('^3[RC-Interactions]^7 Version check: could not parse remote version: ' .. tostring(data.tag_name))
            end
            return
        end

        local cmp = CompareVersions(latest, current)

        if cmp == 0 then
            -- Up to date
            print('^2[RC-Interactions]^7 You are running the latest version (^2' .. currentVersion .. '^7)')

        elseif cmp == 1 then
            -- New version available
            print('')
            print('^3╔══════════════════════════════════════════════════════════════╗^7')
            print('^3║           RC-Interactions — Update Available!               ║^7')
            print('^3╠══════════════════════════════════════════════════════════════╣^7')
            print('^3║^7  Current version:  ^1' .. currentVersion .. '^7')
            print('^3║^7  Latest version:   ^2' .. data.tag_name .. '^7')
            print('^3║^7  Release name:     ^5' .. (data.name or data.tag_name) .. '^7')
            print('^3║^7  Published:        ^5' .. (data.published_at or 'Unknown') .. '^7')
            print('^3║^7  Download:         ^4' .. RELEASE_URL .. '^7')
            print('^3╠══════════════════════════════════════════════════════════════╣^7')
            print('^3║                     Release Notes                           ║^7')
            print('^3╠══════════════════════════════════════════════════════════════╣^7')

            local notes = FormatReleaseNotes(data.body)
            for line in notes:gmatch('[^\n]+') do
                print('^3║^7' .. line)
            end

            print('^3╚══════════════════════════════════════════════════════════════╝^7')
            print('')

        else
            -- Current is newer than latest (development/pre-release build)
            print('^5[RC-Interactions]^7 You are running a development build (^5' .. currentVersion .. '^7 > latest ^3' .. data.tag_name .. '^7)')
        end
    end, 'GET', '', {
        ['User-Agent'] = 'RC-Interactions-FiveM/' .. currentVersion,
        ['Accept'] = 'application/vnd.github.v3+json',
    })
end

-- Run on resource start
AddEventHandler('onResourceStart', function(resName)
    if resName ~= GetCurrentResourceName() then return end

    -- Check if version checking is disabled
    if Config.CheckForUpdates == false then
        if Config.Debug then
            print('^3[RC-Interactions]^7 Version check disabled in config')
        end
        return
    end

    -- Small delay to let the server settle
    SetTimeout(3000, function()
        CheckForUpdates()
    end)
end)
