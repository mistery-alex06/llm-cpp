#include <iostream>
#include <vector>
#include <string>
#include "tokenizer.hpp"
#include "transformer.hpp"

int main() {
    std::cout << "--- LLM Interattivo in C++ ---" << std::endl;
    std::cout << "Scrivi qualcosa e premi invio (digita 'exit' per uscire).\n" << std::endl;

    Tokenizer tokenizer;
    tokenizer.addToken("ciao");
    tokenizer.addToken("come");
    tokenizer.addToken("stai?");
    tokenizer.addToken("ore");

    // Inizializziamo il Transformer con i parametri di base
    Transformer transformer(4, 4);

    std::string user_input;
    while (true) {
        std::cout << "> ";
        if (!std::getline(std::cin, user_input)) break;
        if (user_input == "exit") break;
        if (user_input.empty()) continue;

        std::vector<int> tokens = tokenizer.encode(user_input);
        
        // Generiamo una risposta basata sull'input dell'utente
        int next_token = transformer.forward(tokens);
        std::string response = tokenizer.decode({next_token});

        std::cout << "Bot: " << response << std::endl;
    }

    return 0;
}