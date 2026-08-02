#ifndef TRANSFORMER_HPP
#define TRANSFORMER_HPP

#include <vector>
#include <string>
#include "matrix.hpp"

class Transformer {
private:
    int vocab_size;
    int embed_dim;
    // Matrici dei pesi rudimentali per l'embedding e la predizione
    Matrix weights_embedding;
    Matrix weights_output;

public:
    Transformer(int vocab_size, int embed_dim);
    
    // Funzione principale che elabora i token usando le matrici
    int forward(const std::vector<int>& tokens);
};

#endif