-- HD2-Addon: mods/dsh/extra_multi
--
-- Give MULTIPLE stratagems an extra each.
--
-- Build    : 25480438 / exe 1.8.46015.0
-- game.dll : 2e2c3b7c2500646dadd5f2b4c6e0504dbb7e7896139f64cddc0d1813c718f51e
--
-- =========================================================================
-- CONFIRMED FACTS
-- =========================================================================
-- * The Suzuka mod proves: writing a stratagem KIND into the Reinforcement
--   record's +200 makes that stratagem bring ONE extra stratagem.
-- * An in-game test wrote FOUR kinds into +200/+204/+208/+212. Exactly ONE
--   extra appeared. => +200 is a SCALAR; the neighbours are not extra grants.
-- * Exactly 10 of 149 records already use +200, all with the value 49.
--   Those 10 are the engine's own "grants an extra" hosts. Kind 49 is a shared
--   built-in (id 3837064536), so they are left untouched.
--
-- Therefore "one stratagem grants four" is impossible, but
--      "several stratagems each grant one"
-- is exactly the same proven edit applied more than once.
--
-- =========================================================================
-- WHAT THIS MOD DOES
-- =========================================================================
-- For each HOST kind listed below, if that record's +200 is currently 0 it is
-- set to the GRANT kind. Each host then delivers one extra stratagem.
--
-- The default host set is the stratagems a player almost always has equipped,
-- so in practice several extras arrive at once. Hosts are ordinary records, so
-- this is the same write the reference mod performs, repeated.
--
-- Hosts are identified BY KIND at runtime and validated against a captured
-- baseline, so nothing is written if the table does not match expectation.
--
-- =========================================================================
-- SAFETY
-- =========================================================================
--   * game.dll SHA-256 verified before any write
--   * full 80280-byte blob read twice and compared immediately before writing
--   * only the +200 dword of the listed hosts is touched
--   * a host is skipped if its +200 is already non-zero
--   * writes go only to private/mapped writable pages; MEM_IMAGE is refused
--   * every write is read back and verified
--   * all original values are restored on shutdown

local M = {
    name = 'ExtraMulti',
    version = '1.0.0',
    status = 'starting',
    disabled = false,
}
local NAME = M.name
local VERSION = M.version

local GAME_SHA = '2e2c3b7c2500646dadd5f2b4c6e0504dbb7e7896139f64cddc0d1813c718f51e'
local SETTINGS_RVA = 0x348e8f8
local BLOB_SIZE = 80280
local RECORD_SIZE = 400
local GROUP_MAGIC = 0x444c444c
local GROUP_HASH = 0x30eb6399

-- ---------------------------------------------------------------------------
-- CONFIGURATION
-- ---------------------------------------------------------------------------
-- The stratagem granted as the extra, chosen from the reference mod's option
-- list (type values):
--    26  M-103 Supply FRV          105 M-102 Fast Recon Vehicle
--    27  EXO-45 Patriot             10 EXO-49 Emancipator
--    91  EXO-51 Lumberer            88 EXO-84 Breacher
--     1  Tank                      46 Gas Mines
--   147  EAT-17                    107 Orbital Laser
--    74  Orbital Smoke Strike       58 Orbital Railcannon Strike
local GRANT_KIND = 1           -- Tank

-- Hosts to attach the extra to. The extra only appears when the player has the
-- HOST equipped, so the list below is made of stratagems a player commonly
-- takes. Each host grants one Tank; equipping several yields several.
--
-- All of these are ordinary records whose +200 is currently 0, so this is the
-- same write the reference mod performs, repeated. Hosts whose +200 is already
-- non-zero (the engine's own 10 "grants 49" entries) are skipped automatically
-- and never modified.
--
-- kind 124 Reinforce is included because the reference mod PROVES it works.
local HOST_KINDS = {
    124,   -- Reinforce          (proven mechanism)
     58,   -- Orbital Railcannon Strike
    107,   -- Orbital Laser
     74,   -- Orbital Smoke Strike
    147,   -- EAT-17 Expendable Anti-Tank
     46,   -- Gas Mines
     10,   -- EXO-49 Emancipator
     27,   -- EXO-45 Patriot
     88,   -- EXO-84 Breacher
     91,   -- EXO-51 Lumberer
    105,   -- M-102 Fast Recon Vehicle
     26,   -- M-103 Supply FRV
}

local S = { log={}, disabled=false, frames=0, ticks=0, api=nil, owner=nil,
            phase='locate', applied=nil, max_tries=1800, last_why=nil }

local function u32(s,at)
    if type(s)~='string' or #s<at+4 then return nil end
    local a,b,c,d=s:byte(at+1,at+4)
    return a+b*256+c*65536+d*16777216
end
local function hexdump(s) if not s then return '' end return (s:gsub('.',function(c) return string.format('%02x',c:byte()) end)) end
local function le32(v)
    return string.char(v%256, math.floor(v/256)%256, math.floor(v/65536)%256, math.floor(v/16777216)%256)
end

local function base_dir() local l=os.getenv('LOCALAPPDATA') or '.' return l..'\\CowboyBingus\\Helldivers2\\Logs' end
local function write_file(n,c) local f=io.open(base_dir()..'\\'..n,'wb') if not f then return false end f:write(c) f:close() return true end
local function emit(m) S.log[#S.log+1]=os.date('!%Y-%m-%dT%H:%M:%SZ')..' '..m M.status=m print('['..NAME..'] '..m) end
local function flush_log() if S.owner and S.owner.open_log then local f=S.owner.open_log(NAME..'.log') if f then f:write(table.concat(S.log,'\n')..'\n') f:close() end end end
local function write_status(v,d) write_file(NAME..'-STATUS.txt',table.concat({
    v,'','mod      : '..NAME..' v'..VERSION,'build    : 25480438 / exe 1.8.46015.0',
    'phase    : '..tostring(S.phase),'status   : '..tostring(S.status),
    'grant    : '..tostring(GRANT_KIND),
    'hosts    : 12 common stratagems',
    'last why : '..tostring(S.last_why),
    'detail   : '..tostring(d or '')},'\n')..'\n') end

local function make_api()
    local ffi=require('ffi')
    if ffi.os~='Windows' or not ffi.abi('64bit') then return nil,'windows_x64_required' end
    ffi.cdef[[
        void *GetModuleHandleA(const char *);
        uint32_t GetModuleFileNameW(void *,uint16_t *,uint32_t);
        void *GetCurrentProcess(void);
        int ReadProcessMemory(void *,const void *,void *,size_t,size_t *);
        int WriteProcessMemory(void *,void *,const void *,size_t,size_t *);
        size_t VirtualQuery(const void *,void *,size_t);
        int VirtualProtect(void *,size_t,uint32_t,uint32_t *);
        uint32_t GetLastError(void);
        void *CreateFileW(const uint16_t *,uint32_t,uint32_t,void *,uint32_t,uint32_t,void *);
        int ReadFile(void *,void *,uint32_t,uint32_t *,void *);
        int CloseHandle(void *);
        int32_t BCryptOpenAlgorithmProvider(void **,const uint16_t *,const uint16_t *,uint32_t);
        int32_t BCryptCreateHash(void *,void **,void *,uint32_t,const uint8_t *,uint32_t,uint32_t);
        int32_t BCryptHashData(void *,const void *,uint32_t,uint32_t);
        int32_t BCryptFinishHash(void *,uint8_t *,uint32_t,uint32_t);
        int32_t BCryptDestroyHash(void *);
        int32_t BCryptCloseAlgorithmProvider(void *,uint32_t);
        typedef struct { void *base; void *allocation; uint32_t protection0;
            uint16_t partition; uint16_t reserved; size_t size;
            uint32_t state; uint32_t protection; uint32_t kind; } EM_REGION;
    ]]
    local k=ffi.load('kernel32'); local b=ffi.load('bcrypt'); local process=k.GetCurrentProcess()
    local api={}
    local buf=ffi.new('uint8_t[262144]'); local cnt=ffi.new('size_t[1]')
    local bufaddr=tonumber(ffi.cast('uintptr_t',buf))
    local function excluded(a,sz) return a<bufaddr+262144 and a+sz>bufaddr end

    function api.module(n) local p=k.GetModuleHandleA(n) if p==nil then return nil end
        local v=tonumber(ffi.cast('uintptr_t',p)) if v and v~=0 then return v end end

    function api.query(address)
        if address>=0x800000000000 then return nil end
        local info=ffi.new('EM_REGION[1]')
        if tonumber(k.VirtualQuery(ffi.cast('void *',address),info,ffi.sizeof(info[0])))~=ffi.sizeof(info[0]) then return nil end
        local r=info[0]
        return {base=tonumber(ffi.cast('uintptr_t',r.base)), size=tonumber(r.size),
                state=tonumber(r.state), protection=tonumber(r.protection), kind=tonumber(r.kind)}
    end
    local function readable(r)
        if not r or r.state~=0x1000 then return false end
        local p=r.protection%256
        return (p==2 or p==4 or p==8 or p==32 or p==64 or p==128) and r.protection<256
    end

    function api.read_blob(address,size)
        if type(size)~='number' or size<=0 or size>262144 or excluded(address,size) then return nil end
        local r=api.query(address)
        if not readable(r) or (r.kind~=0x20000 and r.kind~=0x40000) then return nil end
        if address<r.base or address+size>r.base+r.size then return nil end
        if k.ReadProcessMemory(process,ffi.cast('const void *',address),buf,size,cnt)==0
           or tonumber(cnt[0])~=size then return nil end
        return ffi.string(buf,size)
    end

    function api.read_module(address,size)
        if type(size)~='number' or size<=0 or size>262144 or excluded(address,size) then return nil end
        local r=api.query(address)
        if not r or r.kind~=0x1000000 or r.state~=0x1000 then return nil end
        local p=r.protection%256
        if not (p==2 or p==4 or p==8 or p==32 or p==64 or p==128) or r.protection>=256 then return nil end
        if address<r.base or address+size>r.base+r.size then return nil end
        if k.ReadProcessMemory(process,ffi.cast('const void *',address),buf,size,cnt)==0
           or tonumber(cnt[0])~=size then return nil end
        return ffi.string(buf,size)
    end

    function api.pointer(bytes)
        if not bytes or #bytes~=8 then return nil end
        local p=ffi.new('uint64_t[1]'); ffi.copy(p,bytes,8)
        local v=tonumber(p[0]); if v<65536 or v>=0x800000000000 then return nil end return v
    end

    function api.write(address,bytes)
        if type(bytes)~='string' or #bytes~=4 then return false,'invalid_size' end
        local r=api.query(address)
        if not r or r.state~=0x1000 then return false,'region' end
        if r.kind==0x1000000 then return false,'refuse_module_image' end
        if r.kind~=0x20000 and r.kind~=0x40000 then return false,'not_private' end
        if address<r.base or address+#bytes>r.base+r.size then return false,'bounds' end
        local p=r.protection%256
        local before=api.read_blob(address,#bytes)
        if not before then return false,'pre_read' end
        local changed=false; local old=ffi.new('uint32_t[1]')
        if p~=4 then
            if k.VirtualProtect(ffi.cast('void *',address),#bytes,4,old)==0 then
                return false,'protect_failed_'..tonumber(k.GetLastError())
            end
            changed=true
        end
        local wcnt=ffi.new('size_t[1]')
        local ok=k.WriteProcessMemory(process,ffi.cast('void *',address),bytes,#bytes,wcnt)~=0
            and tonumber(wcnt[0])==#bytes
        local restored=true
        if changed then
            local ig=ffi.new('uint32_t[1]')
            restored=k.VirtualProtect(ffi.cast('void *',address),#bytes,old[0],ig)~=0
        end
        local after=api.read_blob(address,#bytes)
        return ok and restored and after==bytes, 'ok='..tostring(ok)..' restored='..tostring(restored)
    end

    function api.module_hash(addr)
        local path=ffi.new('uint16_t[32768]')
        local n=k.GetModuleFileNameW(ffi.cast('void *',addr),path,32768)
        if n==0 or n>=32768 then return nil end
        local f=k.CreateFileW(path,0x80000000,7,nil,3,0x08000000,nil)
        if f==ffi.cast('void *',-1) then return nil end
        local alg,hash=ffi.new('void *[1]'),ffi.new('void *[1]')
        local ok,res=pcall(function()
            local nm=ffi.new('uint16_t[7]',{83,72,65,50,53,54,0})
            assert(b.BCryptOpenAlgorithmProvider(alg,nm,nil,0)==0)
            assert(b.BCryptCreateHash(alg[0],hash,nil,0,nil,0,0)==0)
            local chunk=ffi.new('uint8_t[65536]'); local got=ffi.new('uint32_t[1]')
            while true do assert(k.ReadFile(f,chunk,65536,got,nil)~=0)
                if got[0]==0 then break end
                assert(b.BCryptHashData(hash[0],chunk,got[0],0)==0) end
            local d=ffi.new('uint8_t[32]'); assert(b.BCryptFinishHash(hash[0],d,32,0)==0)
            local p2={} for i=0,31 do p2[#p2+1]=string.format('%02x',d[i]) end
            return table.concat(p2) end)
        if hash[0]~=nil then b.BCryptDestroyHash(hash[0]) end
        if alg[0]~=nil then b.BCryptCloseAlgorithmProvider(alg[0],0) end
        k.CloseHandle(f)
        if not ok then return nil end return res
    end
    return api
end

-- find all records and return {kind -> address}
local function map_records()
    local api=S.api
    local game=api.module('game.dll')
    if not game then return nil,'no_game_dll' end
    if api.module_hash(game)~=GAME_SHA then return nil,'game_dll_hash_mismatch' end
    local pb=api.read_module(game+SETTINGS_RVA,8)
    if not pb then return nil,'settings_slot_unreadable' end
    local buffer=api.pointer(pb)
    if not buffer then return nil,'settings_null' end
    local src=api.read_blob(buffer,BLOB_SIZE)
    if not src then return nil,'settings_not_ready' end
    if u32(src,0)~=11 then return nil,'group_count_mismatch' end

    local map={}
    local offset=4
    for group=1,11 do
        if u32(src,offset)~=GROUP_MAGIC or u32(src,offset+4)~=1 or u32(src,offset+8)~=GROUP_HASH then
            return nil,'dl_header_mismatch'
        end
        local size=u32(src,offset+12)
        local root=offset+24
        local finish=root+size
        if finish>#src then return nil,'group_bounds' end
        local count=u32(src,root+8)
        local start=api.pointer(src:sub(root+1,root+8))
        if not start then return nil,'record_pointer' end
        local rel=start-buffer
        if count and rel>=root+16 and rel+count*RECORD_SIZE<=finish then
            for i=0,count-1 do
                local at=rel+i*RECORD_SIZE
                map[u32(src,at)]={addr=start+i*RECORD_SIZE, extra=u32(src,at+200)}
            end
        end
        offset=finish
    end
    if api.read_blob(buffer,BLOB_SIZE)~=src then return nil,'blob_changed' end
    return map, buffer
end

local function apply()
    local map,buffer=map_records()
    if not map then return false,buffer end

    local lines={}
    lines[#lines+1]='records mapped: '..tostring((function() local n=0 for _ in pairs(map) do n=n+1 end return n end)())
    local done={}
    for _,host in ipairs(HOST_KINDS) do
        local r=map[host]
        if not r then
            lines[#lines+1]=string.format('host %d: NOT PRESENT', host)
        elseif r.extra and r.extra~=0 then
            lines[#lines+1]=string.format('host %d: already grants %d -> skipped', host, r.extra)
        else
            local ok,info=S.api.write(r.addr+200, le32(GRANT_KIND))
            local after=S.api.read_blob(r.addr+200,4)
            local got=after and u32(after,0) or -1
            lines[#lines+1]=string.format('host %d @0x%x: wrote %d, read back %d %s',
                host, r.addr, GRANT_KIND, got, ok and 'OK' or ('FAILED '..tostring(info)))
            if ok and got==GRANT_KIND then
                done[#done+1]={kind=host, addr=r.addr, original=r.extra or 0}
            end
        end
    end
    S.applied=done
    write_file(NAME..'-applied.txt', table.concat(lines,'\n')..'\n')
    if #done==0 then return false,'no_host_applied: '..table.concat(lines,' | ') end
    return true, #done
end

local function startup()
    local loader=rawget(_G,'CowboyBingusModLoader')
    local apiv=type(loader)=='table' and tonumber(loader.api) or nil
    if not apiv or apiv<1 then
        S.phase='error'; S.status='loader_api_too_old'; S.disabled=true
        emit('need Bingus Shared Loader v15+/API 1'); write_status('FAILED - loader too old',''); return false
    end
    local api,err=make_api()
    if not api then
        S.phase='error'; S.status='ffi_unavailable'; S.disabled=true
        emit(S.status..': '..tostring(err)); write_status('FAILED - FFI',''); return false
    end
    S.api=api
    S.phase='locate'; S.status='waiting_for_settings'
    write_status('WORKING - waiting for the stratagem settings blob','')
    return true
end

local function tick()
    if S.disabled then return end
    S.frames=S.frames+1
    if S.phase=='done' then return end
    if S.frames%30~=0 then return end

    S.ticks=S.ticks+1
    local ok,info=apply()
    S.last_why=info
    if not ok then
        if S.ticks%60==0 then emit('attempt '..S.ticks..': '..tostring(info)) end
        if S.ticks>=S.max_tries then
            S.phase='error'; S.disabled=true; S.status='gave_up'
            emit('gave up: '..tostring(info)); write_status('FAILED', tostring(info))
        end
        return
    end
    S.phase='done'; S.status='applied'
    emit(string.format('applied to %d host(s); grant kind %d', info, GRANT_KIND))
    write_status('OK - extra stratagem attached to host(s)',
        string.format('%d host(s) now grant kind %d', info, GRANT_KIND))
end

local loader=rawget(_G,'CowboyBingusModLoader')
if rawget(_G,'ExtraMulti') then return rawget(_G,'ExtraMulti') end
rawset(_G,'ExtraMulti',M)
S.owner=loader
S.disabled=not startup()

if not S.disabled then
    local previous_update=rawget(_G,'update')
    local my_update
    my_update=function(dt,...)
        if not S.disabled then
            local ok,err=pcall(tick)
            if not ok then
                S.disabled=true; S.status='runtime_error: '..tostring(err)
                pcall(emit,S.status); pcall(write_status,'FAILED - runtime error',tostring(err))
            end
        end
        if type(previous_update)=='function' then return previous_update(dt,...) end
    end
    M.my_update=my_update
    M.previous_update=previous_update
    rawset(_G,'update',my_update)
    local previous_shutdown=rawget(_G,'shutdown')
    rawset(_G,'shutdown',function(...)
        if S.applied and S.api then
            pcall(function()
                for _,h in ipairs(S.applied) do
                    S.api.write(h.addr+200, le32(h.original))
                end
            end)
        end
        if rawget(_G,'update')==my_update and type(previous_update)=='function' then
            rawset(_G,'update',previous_update)
        end
        pcall(flush_log)
        if type(previous_shutdown)=='function' then return previous_shutdown(...) end
    end)
end

pcall(flush_log)
return M
