#include "transformer.hpp"
#include <iostream>
#include <cmath>
#include <numeric>

Transformer::Transformer(int vocab_size, int embed_dim) 
    : vocab_size(vocab_size), embed_dim(embed_dim), 
      weights_embedding(vocab_size, embed_dim, 0.1f), 
      weights_output(embed_dim, vocab_size, 0.1f) {
}

int Transformer::forward(const std::vector<int>& tokens) {
    if (tokens.empty()) return 0;

    Matrix current_embedding(1, embed_dim, 0.0f);
    for (int token_id : tokens) {
        if (token_id >= 0 && token_id < vocab_size) {
            for (int j = 0; j < embed_dim; ++j) {
                current_embedding.data[0][j] += weights_embedding.data[token_id][j];
            }
        }
    }

    Matrix logits = Matrix::multiply(current_embedding, weights_output);

    // Applicazione della Softmax per calcolare le probabilità
    std::vector<float> probs(vocab_size, 0.0f);
    float max_logit = logits.data[0][0];
    for (int j = 1; j < vocab_size; ++j) {
        if (logits.data[0][j] > max_logit) max_logit = logits.data[0][j];
    }

    float sum_exp = 0.0f;
    for (int j = 0; j < vocab_size; ++j) {
        probs[j] = std::exp(logits.data[0][j] - max_logit);
        sum_exp += probs[j];
    }

    int best_token = 0;
    float max_prob = -1.0f;
    for (int j = 0; j < vocab_size; ++j) {
        probs[j] /= sum_exp;
        if (probs[j] > max_prob) {
            max_prob = probs[j];
            best_token = j;
        }
    }

    return best_token;
}