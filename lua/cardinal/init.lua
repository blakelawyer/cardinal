local function create_floating_window()
    local buf = vim.api.nvim_create_buf(false, true)
    local width = vim.api.nvim_get_option("columns")
    local height = vim.api.nvim_get_option("lines")

    local win_height = math.ceil(height * 0.8 - 4)
    local win_width = math.ceil(width * 0.8)
    local row = math.ceil((height - win_height) / 2 - 1)
    local col = math.ceil((width - win_width) / 2)

    local opts = {
        style = "minimal",
        relative = "editor",
        width = win_width,
        height = win_height,
        row = row,
        col = col,
        border = "double"
    }

    local win = vim.api.nvim_open_win(buf, true, opts)

    return buf, win
end

local function Cardinal()
    local buf, win = create_floating_window()

    vim.api.nvim_buf_set_lines(buf, 0, -1, false, {"Hello from the floating window!"})
    vim.api.nvim_win_set_option(win, "wrap", false)
end

vim.api.nvim_command('command! Cardinal lua require("cardinal").Cardinal()')

return {
    Cardinal = Cardinal
}
