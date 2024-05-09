use colored::*;
use rusqlite::{params, Connection, Result as SqlResult};
use std::fs::File;
use std::io::{self, BufRead, BufReader, Write};
use term_size;
use regex::Regex;
use std::fmt::Write as FmtWrite;
use std::process;

/// Define a struct representing a card record
#[derive(Debug)]
struct Card {
    id: i32,
    front: String,
    back: String,
    deck: String,
}

fn load_database() -> Result<Connection, rusqlite::Error> {

    let conn = Connection::open("cardinal.db")?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS cards (
            id INTEGER PRIMARY KEY,
            front TEXT NOT NULL,
            back TEXT NOT NULL,
            deck TEXT NOT NULL
        )",
        [],
    )?; 
    
    Ok(conn)

}

fn insert_card(conn: &Connection, front: &str, back: &str, deck: &str) -> SqlResult<()> {
    conn.execute(
        "INSERT INTO cards (front, back, deck) VALUES (?1, ?2, ?3)",
        params![front, back, deck],
    )?;

    Ok(())

}

fn main() -> Result<(), Box<dyn std::error::Error>> {

    let terminal_width = if let Some((width, _)) = term_size::dimensions() {
        width
    } else {
        50 
    };
    
    let card_divider = "=".repeat(terminal_width);

    let conn = load_database()?;
    
    // Open cards file for parsing.
    let file_path = "anki/decks.txt";

    let file = File::open(file_path)?;  

    let reader = BufReader::new(file);

    let mut card_count: i32 = 0;
    let mut inside_card: bool = false;
    let mut card_information = String::new();
    let mut cards = Vec::new();  
    
    for line in reader.lines() {
        let line = line?;

        if line.starts_with("\"") && line.chars().nth(1).is_some() && !inside_card {

            inside_card = true;
            card_information.clear();
            card_information += &line; 
            
        } else if line == "\"" {

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
            
            // Remove inactive clozes.
            let re = Regex::new(r#"<span class=""cloze-inactive"" data-ordinal=""."">(.*?)<\/span>"#).unwrap(); 
            card_information = re.replace_all(&card_information, "$1").to_string();

            // Remove <br><br>.
            let re = Regex::new(r"<br><br>").unwrap();
            card_information = re.replace_all(&card_information, " ").to_string();

            // Remove <br> at the end of cards.
            let re = Regex::new(r"<br>").unwrap();
            card_information = re.replace_all(&card_information, "$1").to_string();

            // Extract the card cloze.
            let re = Regex::new(r#"<span class=""cloze"" data-ordinal=""."">(.*?)<\/span>"#).unwrap(); 

            let mut card_cloze = String::new();
            
            for cap in re.captures_iter(&card_information) {
                card_cloze.push_str(&cap[1]);  
            }

            card_information = re.replace_all(&card_information, "[...]").to_string();

            // Add the card information and cloze to our vector.
            cards.push((card_information.clone(), card_cloze.clone()));                       

            // Print the card front and back.
            println!("{}", "Card Front:".blue());
            println!("{}\n", card_information.white());

            card_information.clear();

            println!("{}", "Card Back:".blue());
            println!("{}", card_cloze.white());
            println!("{}", card_divider.red());

        } else {
            card_information += &line; 
        }

    }

    println!("{} card count: {}", "main:".green(), card_count);

    let mut current_deck = String::new();
    
    for (card_information, card_cloze) in &cards {

        println!("{}", "Card Front:".blue());
        println!("{}", card_information.white());
        println!("{}", "Card Back:".blue());
        println!("{}", card_cloze.white());

        // Prompt for the deck name with a simple input
        print!(
            "Enter deck name or press Enter to keep '{}': ",
            current_deck
        );
        io::stdout().flush().unwrap(); // Ensure prompt is displayed immediately

        // Read the deck name from standard input
        let mut input = String::new();
        io::stdin().read_line(&mut input).unwrap();

        // Trim any whitespace and update the deck name if not empty
        let input_trimmed = input.trim();
        if !input_trimmed.is_empty() {
            current_deck = input_trimmed.to_string();
        }

        // Display the finalized deck name after entering it
        println!("\nDeck: {}", current_deck.blue());
        
        println!("{}", card_divider.red());

        insert_card(&conn, card_information, card_cloze, &current_deck);

    }

    Ok(())
}

