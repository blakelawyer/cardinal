use colored::*;
use rusqlite::{Connection};
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use term_size;
use regex::Regex;

fn load_database() -> Result<(), rusqlite::Error> {

    println!("{} connecting to cardinal database", "load_database:".green());
    let conn = Connection::open("cardinal.db")?;

    println!("{} creating cards table", "load_database:".green());
    conn.execute(
        "CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY,
            front TEXT NOT NULL,
            back TEXT NOT NULL
        )",
        [],
    )?;

    Ok(())
}

fn main() -> io::Result<()> {

    let terminal_width = if let Some((width, _)) = term_size::dimensions() {
        width
    } else {
        50 
    };
    
    let card_divider = "=".repeat(terminal_width);

    println!("{} loading database", "main:".green());
    let _ = load_database();

    // Open cards file for parsing.
    let file_path = "anki/decks.txt";

    let file = File::open(file_path)?;  

    let reader = BufReader::new(file);

    let mut card_count: i32 = 0;
    let mut inside_card: bool = false;
    let mut card_information = String::new();

    for line in reader.lines() {
        let line = line?;

        // what are the possible states when parsing?
        // not inside card, detect start
        // inside card
        // inside card, detect end

        if line.starts_with("\"") && line.chars().nth(1).is_some() && !inside_card {

            println!("{} start of card detected", "main:".blue());
            
            inside_card = true;
            card_information.clear();
            card_information += &line; 
            
        } else if line == "\"" {

            println!("{} end of card detected", "main:".blue());
            
            inside_card = false;
            card_count += 1;

            println!("{}", card_information.white());
            println!("{}", card_divider.red());
            card_information.clear();

            // insert into db / print card info logic

        } else {
            card_information += &line; 
        }

    }

    println!("{} card count: {}", "main:".green(), card_count);

    Ok(())
}

