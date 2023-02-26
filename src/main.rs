use std::io::{stdin, stdout, Write};
use std::io;
use termcolor::{Color, ColorChoice, ColorSpec, StandardStream, WriteColor};
use termion::event::Key;
use termion::input::TermRead;
use termion::raw::IntoRawMode;
use termion::{clear, cursor};

fn display_menu() -> io::Result<()> {
    let mut stdout = StandardStream::stdout(ColorChoice::Always);
    let mut red = ColorSpec::new();
    red.set_fg(Some(Color::Red)).set_bold(true);
    let mut white = ColorSpec::new();
    white.set_fg(Some(Color::White)).set_bold(true);
    stdout.set_color(&red)?;
    writeln!(&mut stdout, "=============================")?;
    write!(&mut stdout, "Cardinal ~")?;
    stdout.set_color(&white)?;
    writeln!(&mut stdout, " Spaced Repetition")?;
    stdout.set_color(&red)?;
    write!(&mut stdout, "   \\\\    1.")?;
    stdout.set_color(&white)?;
    writeln!(&mut stdout, " Study")?;
    stdout.set_color(&red)?;
    write!(&mut stdout, "   (o>   2.")?;
    stdout.set_color(&white)?;
    writeln!(&mut stdout, " Add Cards")?;
    stdout.set_color(&red)?;
    write!(&mut stdout, "\\\\_//)   3.")?;
    stdout.set_color(&white)?;
    writeln!(&mut stdout, " Edit Cards")?;
    stdout.set_color(&red)?;
    write!(&mut stdout, " \\_/_)   4.")?;
    stdout.set_color(&white)?;
    writeln!(&mut stdout, " Sync")?;
    stdout.set_color(&red)?;
    write!(&mut stdout, "   |     5.")?;
    stdout.set_color(&white)?;
    writeln!(&mut stdout, " Exit")?;
    stdout.set_color(&red)?;
    writeln!(&mut stdout, "=============================")?;
    Ok(())
}

fn clear_screen() {
    let mut stdout = stdout().into_raw_mode().unwrap();
    write!(stdout, "{}{}", clear::All, cursor::Goto(1,1)).unwrap();
    drop(stdout);
}

fn study () {
    println!("Study!");
}


fn add_cards() {
    println!("Add cards!");
}

fn edit_cards() {
    println!("Edit cards!");
}

fn sync () {
    println!("Sync!");
}

fn exit () {
    println!("Exit!");
}


fn main() {

    clear_screen();
    display_menu().unwrap();
    loop {
        let mut stdout = stdout().into_raw_mode().unwrap();
        let stdin = stdin();
        for c in stdin.keys() {
            match c.unwrap() {
                Key::Char('1') => study(),
                Key::Char('2') => add_cards(),
                Key::Char('3') => edit_cards(),
                Key::Char('4') => sync(),
                Key::Char('5') => {
                    drop(stdout);
                    println!();
                    std::process::exit(0);
                },
                    _ => (),
                }
            }
    }
}
