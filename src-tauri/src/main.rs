// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use rusqlite::{Connection, Result as SqlResult};
use std::error::Error;
use serde::Serialize;
use once_cell::sync::Lazy;
use std::sync::Mutex;

static STATE: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::from("main_menu")));

fn get_state() -> Result<String, String> {
    let state = STATE.lock().map_err(|e| e.to_string())?;
    Ok(state.clone())
}

fn set_state(new_state: &str) -> Result<(), String> {
    let mut state = STATE.lock().map_err(|e| e.to_string())?;
    *state = new_state.to_string();
    Ok(())
}

#[derive(Debug, Serialize)]
struct Card {
    id: i32,
    front: String,
    back: String,
    deck: String,
}

fn run_query(query: &str) -> Result<Vec<Vec<String>>, String> {
    let conn = Connection::open("cardinal.db").map_err(|e| e.to_string())?;
    println!("Successfully connected to the database.");

    println!("Running query: {}", query);

    let mut stmt = conn.prepare(query).map_err(|e| {
        println!("Failed to prepare statement: {}", e);
        e.to_string()
    })?;

    let column_count = stmt.column_count();

    let mut rows = stmt.query([]).map_err(|e| {
        println!("Failed to execute query: {}", e);
        e.to_string()
    })?;

    let mut results = Vec::new();

    while let Some(row) = rows.next().map_err(|e| e.to_string())? {
        let mut row_result = Vec::new();
        for index in 0..column_count {
            let value = match row.get_ref(index).unwrap() {
                rusqlite::types::ValueRef::Integer(i) => i.to_string(),
                rusqlite::types::ValueRef::Real(r) => r.to_string(),
                rusqlite::types::ValueRef::Text(t) => String::from_utf8_lossy(t).to_string(),
                rusqlite::types::ValueRef::Blob(b) => format!("{:?}", b),
                rusqlite::types::ValueRef::Null => "NULL".to_string(),
            };
            row_result.push(value);
        }
        results.push(row_result);
    }

    Ok(results)
}

#[tauri::command]
fn log(message: String) {
    println!("{}", message);
}

#[tauri::command]
fn study() {
    println!("study()");
    set_state("study_menu");
}

#[tauri::command]
fn edit() -> Result<Vec<String>, String> {
    println!("edit()");
    set_state("edit_menu");

    let query = "SELECT DISTINCT deck FROM cards";

    let raw_results = match run_query(query) {
        Ok(results) => results,
        Err(e) => {
            println!("Failed to run query: {}", e);
            return Err(e);
        }
    };

    let mut decks = Vec::new();

    for row in raw_results {
        for value in row {
            decks.push(value); 
        }
    }

    for deck in &decks {
        println!("Deck: {}", deck);
    }

    Ok(decks)
}

#[tauri::command]
fn edit_deck(deck: String) -> Result<Vec<Card>, String> {
    println!("edit_deck({})", deck);
    set_state("editing_deck");

    let query = format!("SELECT id, front, back, deck FROM cards WHERE deck = '{}'", deck);

    let raw_results = match run_query(&query) {
        Ok(results) => results,
        Err(e) => {
            println!("Failed to run query: {}", e);
            return Err(e);
        }
    };

    let mut cards = Vec::new();

    for row in raw_results {
        if row.len() == 4 {
            let id = row[0].parse::<i32>().map_err(|e| e.to_string())?;
            let front = row[1].clone();
            let back = row[2].clone();
            let deck = row[3].clone();
            cards.push(Card { id, front, back, deck });
        } else {
            println!("Unexpected number of columns in row: {:?}", row);
            return Err("Unexpected number of columns in row".to_string());
        }
    }

    for card in &cards {
        println!("{:?}", card);
    }

    Ok(cards)

}

#[tauri::command]
fn edit_card(id: i32, front: String, back: String, deck: String) {
    println!("edit_card(id: {}, front: {}, back: {}, deck: {})", id, front, back, deck);
}

#[tauri::command]
fn create() {
    println!("create()");
    set_state("create_menu");
}

#[tauri::command]
fn back() -> Result<String, String> {
    println!("back()");

    let current_state = get_state()?;
    println!("Current state: {}", current_state);

    let next_page = if current_state == "study_menu" {
        set_state("main_menu")?;
        "../index"
    } else if current_state == "edit_menu" {
        set_state("main_menu")?;
        "../index"
    } else if current_state == "create_menu" {
        set_state("main_menu")?;
        "../index"
    } else if current_state == "editing_deck" {
        set_state("edit_menu")?;
        "../html/edit"
    } else {
        "../index" 
    };
    
    Ok(next_page.to_string())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![log, study, edit, create, back, edit_deck, edit_card])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

