local function Cardinal()
    print("Hello from Cardinal!")
end

vim.api.nvim_command('command! Cardinal lua require("cardinal").Cardinal()')

return {
    Cardinal = Cardinal
}
