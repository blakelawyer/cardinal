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

    local win = vim.api.nvim_open_win(buf, false, opts)

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

    local title = "Cardinal"
    local title_len = #title
    local left_padding = math.floor((win_width - title_len) / 2)
    local right_padding = win_width - left_padding - title_len

    -- Draw border lines
    local top_line = border_chars[5] .. string.rep(border_chars[1], left_padding) .. title .. string.rep(border_chars[1], right_padding) .. border_chars[6]
    local middle_line = border_chars[2] .. string.rep(" ", win_width) .. border_chars[2]
    local bottom_line = border_chars[8] .. string.rep(border_chars[3], win_width) .. border_chars[7]

    vim.api.nvim_buf_set_lines(border_buf, 0, 1, false, {top_line})
    for i = 2, win_height + 1 do
        vim.api.nvim_buf_set_lines(border_buf, i - 1, i, false, {middle_line})
    end
    vim.api.nvim_buf_set_lines(border_buf, win_height + 1, win_height + 2, false, {bottom_line})

    -- Set border highlight group
    local highlight_group = "CardinalBorder"
    vim.cmd(string.format("highlight %s guifg=#FF0000", highlight_group))

    -- Add highlights to the entire border
    for i = 0, win_height + 1 do
        vim.api.nvim_buf_add_highlight(border_buf, -1, highlight_group, i, 0, -1)
    end

    -- Add highlights to the title
    vim.api.nvim_buf_add_highlight(border_buf, -1, highlight_group, 0, left_padding, left_padding + title_len)


    return buf, win
end

local function set_keymaps(buf)
    local mappings = {
        ['j'] = 'lua require("cardinal").move_cursor(1)',
        ['k'] = 'lua require("cardinal").move_cursor(-1)',
        ['<CR>'] = 'lua require("cardinal").select_option()',
    }

    for key, action in pairs(mappings) do
        vim.api.nvim_buf_set_keymap(buf, 'n', key, action, {noremap = true, silent = true})
    end
end

local function Cardinal()
    local buf, win = create_floating_window()

    -- Set bird text highlight group
    local bird_highlight_group = "CardinalBird"
    vim.cmd(string.format("highlight %s guifg=#FF0000", bird_highlight_group))

    local bird_lines = {
        "   \\\\",
        "   (o>",
        "\\\\_//)",
        " \\_/_)",
        "  _|_"
    }

    -- Set bird lines
    for i, line in ipairs(bird_lines) do
        vim.api.nvim_buf_set_lines(buf, i - 1, i, false, {line})
    end

    -- Set bird text highlight
    for i, _ in ipairs(bird_lines) do
        vim.api.nvim_buf_add_highlight(buf, -1, "CardinalBird", i - 1, 0, -1)
    end

    -- Add menu options
    local menu_options = {
        "1.",
        "2.",
        "3.",
        "4.",
        "5.",
    }

    local start_line = #bird_lines + 2

    for i, option in ipairs(menu_options) do
        vim.api.nvim_buf_set_lines(buf, start_line + i - 1, start_line + i, false, {option})
    end

    vim.api.nvim_win_set_option(win, "wrap", false)
    vim.api.nvim_win_set_cursor(win, {start_line, 0})

    -- Set keymaps for navigation and selection
    set_keymaps(buf)

end

vim.api.nvim_command('command! Cardinal lua require("cardinal").Cardinal()')

return {
    Cardinal = Cardinal
}
