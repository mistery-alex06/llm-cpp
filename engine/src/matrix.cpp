#include "matrix.hpp"

Matrix::Matrix(int r, int c, float initial_value) : rows(r), cols(c) {
    data.resize(rows, std::vector<float>(cols, initial_value));
}

Matrix Matrix::multiply(const Matrix& a, const Matrix& b) {
    if (a.cols != b.rows) {
        std::cerr << "Errore: Dimensioni incompatibili per la moltiplicazione di matrici!" << std::endl;
        return Matrix(1, 1, 0.0f);
    }

    Matrix result(a.rows, b.cols, 0.0f);
    for (int i = 0; i < a.rows; ++i) {
        for (int j = 0; j < b.cols; ++j) {
            for (int k = 0; k < a.cols; ++k) {
                result.data[i][j] += a.data[i][k] * b.data[k][j];
            }
        }
    }
    return result;
}

void Matrix::print() const {
    for (int i = 0; i < rows; ++i) {
        for (int j = 0; j < cols; ++j) {
            std::cout << data[i][j] << " ";
        }
        std::cout << std::endl;
    }
}