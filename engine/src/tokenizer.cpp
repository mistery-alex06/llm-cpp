#include "tokenizer.hpp"
#include <sstream>

Tokenizer::Tokenizer() : next_id(0) {}

void Tokenizer::addToken(const std::string& token) {
    if (stoi_map.find(token) == stoi_map.end()) {
        stoi_map[token] = next_id;
        itos_map[next_id] = token;
        next_id++;
    }
}

std::vector<int> Tokenizer::encode(const std::string& text) const {
    std::vector<int> tokens;
    std::stringstream ss(text);
    std::string word;
    
    while (ss >> word) {
        auto it = stoi_map.find(word);
        if (it != stoi_map.end()) {
            tokens.push_back(it->second);
        } else {
            tokens.push_back(0); 
        }
    }
    return tokens;
}

std::string Tokenizer::decode(const std::vector<int>& tokens) const {
    std::string result = "";
    for (size_t i = 0; i < tokens.size(); ++i) {
        auto it = itos_map.find(tokens[i]);
        if (it != itos_map.end()) {
            result += it->second;
            if (i < tokens.size() - 1) result += " ";
        }
    }
    return result;
}

int Tokenizer::getVocabSize() const {
    return next_id;
}