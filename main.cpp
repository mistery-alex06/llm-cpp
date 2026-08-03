#include <cstdio>
#include <cstring>
#include <iostream>
#include <string>
#include <vector>
#include <filesystem>

#include "llama.h"

namespace fs = std::filesystem;

// Trova il modello .gguf nella cartella del progetto, indipendentemente
// da dove viene lanciato l'eseguibile.
static std::string find_model_path() {
    std::vector<fs::path> candidates = {
        "Qwen3-4B-Q4_K_M.gguf",
        "../Qwen3-4B-Q4_K_M.gguf",
        "../../Qwen3-4B-Q4_K_M.gguf"
    };
    for (const auto& c : candidates) {
        if (fs::exists(c)) return fs::absolute(c).string();
    }
    return "";
}

int main(int argc, char** argv) {
    std::cout << "--- LLM Interattivo in C++ (motore llama.cpp integrato) ---" << std::endl;
    std::cout << "Scrivi qualcosa e premi invio (riga vuota o 'exit' per uscire).\n" << std::endl;

    std::string model_path = (argc > 1) ? argv[1] : find_model_path();
    if (model_path.empty()) {
        std::cerr << "Errore: modello .gguf non trovato. Passa il percorso come argomento,\n"
                  << "es: ./llm /percorso/Qwen3-4B-Q4_K_M.gguf" << std::endl;
        return 1;
    }
    std::cout << "Modello: " << model_path << std::endl;

    // Solo errori nei log del motore
    llama_log_set([](enum ggml_log_level level, const char* text, void*) {
        if (level >= GGML_LOG_LEVEL_ERROR) fprintf(stderr, "%s", text);
    }, nullptr);

    ggml_backend_load_all();

    llama_model_params model_params = llama_model_default_params();
    model_params.n_gpu_layers = 0; // CPU-only, coerente con run_qwen.sh su questo hardware

    llama_model* model = llama_model_load_from_file(model_path.c_str(), model_params);
    if (!model) {
        std::cerr << "Errore: impossibile caricare il modello." << std::endl;
        return 1;
    }
    const llama_vocab* vocab = llama_model_get_vocab(model);

    llama_context_params ctx_params = llama_context_default_params();
    ctx_params.n_ctx = 2048;
    ctx_params.n_batch = 2048;

    llama_context* ctx = llama_init_from_model(model, ctx_params);
    if (!ctx) {
        std::cerr << "Errore: impossibile creare il contesto." << std::endl;
        llama_model_free(model);
        return 1;
    }

    llama_sampler* sampler = llama_sampler_chain_init(llama_sampler_chain_default_params());
    llama_sampler_chain_add(sampler, llama_sampler_init_min_p(0.05f, 1));
    llama_sampler_chain_add(sampler, llama_sampler_init_temp(0.7f));
    llama_sampler_chain_add(sampler, llama_sampler_init_dist(LLAMA_DEFAULT_SEED));

    // Genera la risposta per un prompt già formattato col chat template, stampandola token per token
    auto generate = [&](const std::string& prompt) -> std::string {
        std::string response;
        const bool is_first = llama_memory_seq_pos_max(llama_get_memory(ctx), 0) == -1;

        const int n_prompt_tokens = -llama_tokenize(vocab, prompt.c_str(), (int)prompt.size(), nullptr, 0, is_first, true);
        std::vector<llama_token> prompt_tokens(n_prompt_tokens);
        if (llama_tokenize(vocab, prompt.c_str(), (int)prompt.size(), prompt_tokens.data(), (int)prompt_tokens.size(), is_first, true) < 0) {
            std::cerr << "Errore di tokenizzazione." << std::endl;
            return response;
        }

        llama_batch batch = llama_batch_get_one(prompt_tokens.data(), (int)prompt_tokens.size());
        llama_token new_token_id;

        while (true) {
            int n_ctx = llama_n_ctx(ctx);
            int n_ctx_used = llama_memory_seq_pos_max(llama_get_memory(ctx), 0) + 1;
            if (n_ctx_used + batch.n_tokens > n_ctx) {
                std::cerr << "\n[contesto esaurito]" << std::endl;
                break;
            }
            if (llama_decode(ctx, batch) != 0) {
                std::cerr << "Errore durante il decode." << std::endl;
                break;
            }

            new_token_id = llama_sampler_sample(sampler, ctx, -1);
            if (llama_vocab_is_eog(vocab, new_token_id)) break;

            char buf[256];
            int n = llama_token_to_piece(vocab, new_token_id, buf, sizeof(buf), 0, true);
            if (n < 0) break;
            std::string piece(buf, n);
            std::cout << piece << std::flush;
            response += piece;

            batch = llama_batch_get_one(&new_token_id, 1);
        }
        return response;
    };

    std::vector<llama_chat_message> messages;
    std::vector<char> formatted(llama_n_ctx(ctx));
    int prev_len = 0;
    std::string user_input;

    while (true) {
        std::cout << "\n> ";
        if (!std::getline(std::cin, user_input)) break;
        if (user_input.empty() || user_input == "exit") break;

        const char* tmpl = llama_model_chat_template(model, nullptr);

        messages.push_back({"user", strdup(user_input.c_str())});
        int new_len = llama_chat_apply_template(tmpl, messages.data(), messages.size(), true, formatted.data(), (int)formatted.size());
        if (new_len > (int)formatted.size()) {
            formatted.resize(new_len);
            new_len = llama_chat_apply_template(tmpl, messages.data(), messages.size(), true, formatted.data(), (int)formatted.size());
        }
        if (new_len < 0) {
            std::cerr << "Errore nel chat template." << std::endl;
            break;
        }

        std::string prompt(formatted.begin() + prev_len, formatted.begin() + new_len);

        std::cout << "Bot: ";
        std::string response = generate(prompt);
        std::cout << std::endl;

        messages.push_back({"assistant", strdup(response.c_str())});
        prev_len = llama_chat_apply_template(tmpl, messages.data(), messages.size(), false, nullptr, 0);
        if (prev_len < 0) {
            std::cerr << "Errore nel chat template." << std::endl;
            break;
        }
    }

    for (auto& msg : messages) free(const_cast<char*>(msg.content));
    llama_sampler_free(sampler);
    llama_free(ctx);
    llama_model_free(model);

    return 0;
}
