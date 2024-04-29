use colored::*;
use rusqlite::{Connection};
use std::fs::File;
use std::io::{self, BufRead, BufReader};
use term_size;
use regex::Regex;
use std::fmt::Write;
use std::process;

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
            
            // Extract the raw card information without Anki formatting.
            let re = Regex::new(r"\t(.*)").unwrap();
    
            if let Some(caps) = re.captures(&card_information) {
                let extracted_format = caps[1].to_string(); 
                card_information.clear(); 
                write!(card_information, "{}", extracted_format).unwrap(); 
            } else {
                println!("No match found!");
                process::exit(0);
            }
            
            println!("{}", card_information.blue());

            // Remove inactive clozes.
            let re = Regex::new(r#"<span class=""cloze-inactive"" data-ordinal=""."">(.*?)<\/span>"#).unwrap(); 
            card_information = re.replace_all(&card_information, "$1").to_string();

            // Remove <br> at the end.
            let re = Regex::new(r#"<br>"#).unwrap(); 
            card_information = re.replace_all(&card_information, "$1").to_string();

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

