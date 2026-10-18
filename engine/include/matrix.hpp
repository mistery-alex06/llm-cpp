#ifndef MATRIX_HPP
#define MATRIX_HPP

#include <vector>
#include <iostream>

class Matrix {
public:
    int rows;
    int cols;
    std::vector<std::vector<float>> data;

    Matrix(int r, int c, float initial_value = 0.0f);
    
    static Matrix multiply(const Matrix& a, const Matrix& b);
    void print() const;
};

#endif