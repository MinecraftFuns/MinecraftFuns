---
title: "C++ | Comparing const and constexpr"
description: "Compares the semantics of const and constexpr in C++ for objects and functions, with examples covering member functions and constexpr functions."
date: "2020-01-26"
tags: ["C++"]
translation: machine
---

![hero.webp](https://ragnarok.joefang.org/static/xiau5eaapp4456o6jfdcivbfjjdm8o26a.webp)

> @brief:  
> An object qualified with `constexpr` is guaranteed to have its value computed at compile time, so it can be optimized more thoroughly  
> @warning:  
> `constexpr` only arrived in `C++11`, and CCF contests were still judged as `C++98` back then, so submitting it meant a compile error and a zero (two lines of tears)  

Actually, `const` does not really mean "constant". It is merely a qualifier on a variable, telling the compiler that the variable can only be initialized and not directly modified (in practice it can still be modified via things like stack overflow). The value of such a variable can be specified either at run time or at compile time.

`constexpr` can be used to qualify variables, functions, and constructors. Once any of these is qualified with `constexpr`, it is effectively telling the compiler "feel free to treat me as an expression whose constant value can be obtained at compile time, and optimize accordingly."

## For objects

`const` refers to both *compile-time constants* and *run-time constants*, without distinguishing between them.  
`constexpr` refers specifically to *compile-time constants*.  

## For functions

In `C++11`, the return value and parameters of a function qualified with `constexpr` must be guaranteed to be literal values, and the function body must consist of exactly one `return` statement. This places more constraints on the function's designer; typically the return literal can only be computed through `return ternary operator` plus `recursion`.

In `C++14`, it is enough for the return value and parameters to be literal values; the function body can contain more statements, allowing for more flexible computation.

**`const` can qualify a class's member functions; a function so qualified will not change the value of the object during execution.**

```cpp
class Person
{
public:
    string getName() const;
    void setAge() const;

private:
    string name;
    mutable int age;
};

// compiles
string
Person::getName() const
{
    return this->name;
}

// does not compile: name is not mutable
string Person::getName() const
{
    this->name = "test";
    return this->name;
}

// compiles: age is mutable
void Person::setAge() const
{
    ++age;
}
```

Assuming this function has no `public` qualifier, and the `name` data member is not marked `mutable`, then this function will not change the object pointed to by `this` during its call. In other words, if a member function qualified as `const` changes a data member of `this` during execution, that function will fail to compile.

If a data member qualified with `mutable` is changed inside such a function, that is allowed.

**For a function qualified with `constexpr`, the return value is not necessarily a compile-time constant.**  

```cpp
constexpr int foo(int i)
{
    return ++i;
}

int main()
{
    int i = 10;
    // fine: foo(5) is a constant expression
    array<int, foo(5)> arr;
    // fine: an ordinary run-time call
    foo(i);
    // error: foo(i) is not a constant expression
    array<int, foo(i)> arr1;
    return 0;
}
```

In the code above, the first and second calls are both correct; the third call produces an error.

* In the first case, `foo(5)` uses the constant expression `5`, so the result can be obtained at compile time, which determines the size of the `array`, so this declaration is correct.
* In the second case, `foo(i)` uses a variable, and the result can be obtained at run time, so this call is correct.
* In the third case, `foo(i)` uses a variable, whose result can only be obtained at run time, but the declaration of `array` requires its size to be determined at compile time and unchangeable, so this declaration is an error.

So for a function qualified with `constexpr`, if the arguments passed in can be computed at compile time, the function will produce a compile-time value. If the arguments passed in cannot be computed at compile time, then the `constexpr`-qualified function behaves just like an ordinary function.
