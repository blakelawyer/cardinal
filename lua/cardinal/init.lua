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
    }

    local win = vim.api.nvim_open_win(buf, true, opts)

    -- Border buffer and window
    local border_buf = vim.api.nvim_create_buf(false, true)
    local border_opts = {
        style = "minimal",
        relative = "editor",
        width = win_width + 2,
        height = win_height + 2,
        row = row - 1,
        col = col - 1
    }
    local border_win = vim.api.nvim_open_win(border_buf, false, border_opts)

    -- Double border characters
    local border_chars = {
        "═", "║", "═", "║",
        "╔", "╗", "╝", "╚"
    }

    local top_line = border_chars[5] .. string.rep(border_chars[1], win_width) .. border_chars[6]
    local mid_line = border_chars[2] .. string.rep(" ", win_width) .. border_chars[4]
    local bot_line = border_chars[8] .. string.rep(border_chars[3], win_width) .. border_chars[7]

    vim.api.nvim_buf_set_lines(border_buf, 0, 1, false, {top_line})
    for i = 1, win_height do
        vim.api.nvim_buf_set_lines(border_buf, i, i + 1, false, {mid_line})
    end
    vim.api.nvim_buf_set_lines(border_buf, win_height + 1, -1, false, {bot_line})

    -- Set border highlight group
    local highlight_group = "CardinalBorder"
    vim.cmd(string.format("highlight %s guifg=#FF0000", highlight_group))
    vim.api.nvim_buf_add_highlight(border_buf, -1, highlight_group, 0, 0, -1)

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
