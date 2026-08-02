#pragma once

#include <string>
#include <vector>
#include <unordered_map>

class Tokenizer {
private:
    std::unordered_map<std::string, int> stoi_map;
    std::unordered_map<int, std::string> itos_map;
    int next_id;

public:
    Tokenizer();

    void addToken(const std::string& token);
    std::vector<int> encode(const std::string& text) const;
    std::string decode(const std::vector<int>& tokens) const;
    int getVocabSize() const;
};