# Solving the Easy Stream 3 Problem in the DASCTF Cybersecurity Competition

> `name`: easystream3  
> `category`: crypto  
> `tag`: stream cipher  
> `flag`: `DASCTF{88ac22ea2ce99c7a325fe6ce2ddd3718}`  

As a freshman in university with limited knowledge of cybersecurity, I was introduced to Capture the Flag (CTF) competitions for the first time. Although CTF and Olympiad in Informatics (OI) share some criteria, such as a high demand for coding ability and the need for bravery when things go wrong, I found that CTF problems require more flexible thinking patterns.

![hero.webp](https://bafkreihct75b7fqhn5yhh3ojzcmy6bnvplangwgevekgh7lahlz6wnf2mu.ipfs.dweb.link/)

The source code for the problem is available on [GitHub Gist](https://gist.github.com/MinecraftFuns/d6873a1b8aa67d83df02408afb58e2a4), and I recommend you look at it before continuing to read.

The problem suggests we analyze the methods defined in `class lfsr()`.

```py
class lfsr():
    def __init__(self, seed, mask, length):
        self.length_mask = 2 ** length - 1
        self.mask = mask & self.length_mask
        self.state = seed & self.length_mask
        print(self.state, self.mask)

    def next(self):
        next_state = (self.state << 1) & self.length_mask
        i = self.state & self.mask & self.length_mask
        output = 0
        while i != 0:
            output ^= (i & 1)
            i = i >> 1
        next_state ^= output
        self.state = next_state
        return output

    def getrandbit(self, nbit):
        output = 0
        for _ in range(nbit):
            output = (output << 1) ^ self.next()
        return output
```

First, we can notice that in the function `def next()`, the generated 1-bit `output` is appended to the `state` variable, whose highest bit is discarded. The computation of the `output` variable is in equivalence to the C++ expression `std::popcount(state & mask) & 1`, indicating that the `output` depends on the number of $1\operatorname{s}$ in the binary representation of `state & mask`. If we do `def next()` 32 times, the initial state will be entirely replaced by the newly generated bits. Therefore, we can recover the `state` variable with the knowledge of the first four letters (`DASC`).

Now we need to uncover the value of the `mask` variable. [My solution](https://gist.github.com/MinecraftFuns/44173a642b4886c86a2f4198f02c20a2), which enumerates all possible values of a 32-bit unsigned integer and checks them against the next 3 bytes (`TF{`) and the last 1 byte (`}`), is relatively straightforward and brute-force.

In conclusion, the Easy Stream 3 problem is entry-level and requires little brainstorming. I would tag it with `implementation` if it were a Codeforces problem.

> The article is also available in [Chinese](https://bafkreiccxkgfot73sjtq6rx6ruvuks3dt4tf63nh6ksdtxupegsedh6bce.ipfs.inbrowser.link/?filename=Crypto.pdf).
