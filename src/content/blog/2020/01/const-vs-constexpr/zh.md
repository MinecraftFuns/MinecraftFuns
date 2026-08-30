---
title: "C++ | 对比：const 和 constexpr"
description: "对比 C++ 中 const 和 constexpr 修饰对象与函数时的语义差异，并给出成员函数与 constexpr 函数的示例。"
date: "2020-01-26"
tags: ["C++"]
---

![hero.webp](https://ragnarok.joefang.org/static/xiau5eaapp4456o6jfdcivbfjjdm8o26a.webp)

> @brief:  
> 用 `constexpr` 修饰的对象，能保证值在编译期就算出来，所以优化得更到位  
> @warning:  
> `constexpr` 在 `C++11` 中才出现，所以（爆零两行泪）  

其实，`const` 并不能代表“常量”，它仅仅是对变量的一个修饰，告诉编译器这个变量只能被初始化，且不能被直接修改（实际上可以通过堆栈溢出等方式修改）。而这个变量的值，可以在运行时也可以在编译时指定。

`constexpr` 可以用来修饰变量、函数、构造函数。一旦以上任何元素被 `constexpr` 修饰，那么等于说是告诉编译器 “请大胆地将我看成编译时就能得出常量值的表达式去优化我”。

## 对于对象来说

`const` 指的是*编译期常量*和*运行时常量*，两者并没有区分  
`constexpr` 特指*编译期常量*  

## 对于函数来说

`C++11` 中的 `constexpr` 指定的函数返回值和参数必须要保证是字面值，而且必须有且只有一行 `return` 代码，这给函数的设计者带来了更多的限制，比如通常只能通过 `return 三目运算符` + `递归` 来计算返回的字面值。

而 `C++14` 中只要保证返回值和参数是字面值就行了，函数体中可以加入更多的语句，方便了更灵活的计算。

**`const` 可以修饰类的成员函数，被修饰的函数在执行期间不会改变对象的值。**

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

// 可以执行
string
Person::getName() const
{
    return this->name;
}

// 不能执行
string Person::getName() const
{
    this->name = "test";
    return this->name;
}

//可以执行
void Person::setAge() const
{
    ++age;
}
```

假设此函数没有 `public` 限定，且 `name` 数据成员没有使用 `mutable` 修饰，那么此函数在调用期间不会改变 `this` 所指的对象，也就是说，如果某个被修饰成 `const` 的成员函数在执行期间改变了 `this` 中的数据成员，那么这个函数会报错。

如果在此类函数中改变了使用 `mutable` 修饰的数据成员，这是允许的。

**`constexpr` 修饰的函数，返回值不一定是编译期常量**  

```cpp
constexpr int foo(int i)
{
    return ++i;
}

int main()
{
    int i = 10;
    // 成功调用
    array<int, foo(5)> arr;
    // 成功调用
    foo(i);
    // 错误
    array<int, foo(i)> arr1;
    return 0;
}
```

上面的代码中，第一次和第二次执行都是正确的，第三次执行会报错。

* 第一次中，`foo(5)` 使用的是常量表达式 `5`，所以在编译期间就可以得出结果，从而确定 `array` 的大小，所以这个声明是正确的；
* 第二次中，`foo(i)` 使用的是变量，在运行时可以得到结果，所以这个调用是正确的；
* 第三次中，`foo(i)` 使用的是变量，在运行时才能得到结果，但 `array` 的声明要求在编译期就必须要确定其大小，且不能改变，所以这个声明是错误的。

所以，对于 `constexpr` 修饰的函数，如果其传入的参数可以在编译期算出来，那么这个函数就会产生编译期的值。如果传入的参数不能在编译时期计算出来，那么 `constexpr` 修饰的函数就和普通函数一样了。
